import { and, eq, gt, isNull } from "drizzle-orm";
import { db, type DB } from "@/db";
import { invites, sessions, users } from "@/db/schema";
import { hashPassword, randomToken, sha256 } from "@/lib/auth/crypto";

const INVITE_TTL_MS = 14 * 24 * 60 * 60 * 1000;

type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];

/** Returns the raw token; only its hash is stored. */
export async function createInvite(userId: string, tx: DB | Tx = db): Promise<string> {
  const token = randomToken();
  await tx.insert(invites).values({
    tokenHash: sha256(token),
    userId,
    expiresAt: new Date(Date.now() + INVITE_TTL_MS),
  });
  return token;
}

export async function findValidInvite(token: string) {
  const [row] = await db
    .select({ tokenHash: invites.tokenHash, userId: users.id, name: users.name, email: users.email })
    .from(invites)
    .innerJoin(users, eq(users.id, invites.userId))
    .where(and(eq(invites.tokenHash, sha256(token)), isNull(invites.usedAt), gt(invites.expiresAt, new Date())));
  return row ?? null;
}

/** Sets the password and burns the invite. Returns the user id, or null if the invite is invalid. */
export async function acceptInvite(token: string, password: string): Promise<string | null> {
  const invite = await findValidInvite(token);
  if (!invite) return null;
  const passwordHash = await hashPassword(password);
  return db.transaction(async (tx) => {
    const burned = await tx
      .update(invites)
      .set({ usedAt: new Date() })
      .where(and(eq(invites.tokenHash, invite.tokenHash), isNull(invites.usedAt)))
      .returning({ userId: invites.userId });
    if (burned.length === 0) return null;
    await tx.update(users).set({ passwordHash }).where(eq(users.id, invite.userId));
    // A reset link logs out every existing session.
    await tx.delete(sessions).where(eq(sessions.userId, invite.userId));
    return invite.userId;
  });
}
