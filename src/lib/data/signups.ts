import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { agencies, clients, users } from "@/db/schema";
import { hashPassword } from "@/lib/auth/crypto";
import { assertAdmin, NotFoundError, resolveClientId, type Viewer } from "./viewer";

// Self sign-up: anyone with an agency's join link can create an account, but it
// stays "pending" (no client, no data access) until an agency admin approves it.

export async function getAgencyByJoinCode(joinCode: string) {
  const [row] = await db
    .select({ id: agencies.id, name: agencies.name, accentColor: agencies.accentColor })
    .from(agencies)
    .where(eq(agencies.joinCode, joinCode));
  return row ?? null;
}

export class EmailTakenError extends Error {}

/** Creates a pending client user. Returns the new user id. */
export async function signUp(input: { joinCode: string; name: string; email: string; password: string; business: string }) {
  const agency = await getAgencyByJoinCode(input.joinCode);
  if (!agency) throw new NotFoundError("Unknown sign-up link");
  const email = input.email.toLowerCase();
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (existing) throw new EmailTakenError();
  const passwordHash = await hashPassword(input.password);
  try {
    const [user] = await db
      .insert(users)
      .values({ agencyId: agency.id, role: "client", status: "pending", name: input.name, email, signupBusiness: input.business, passwordHash })
      .returning({ id: users.id });
    return user.id;
  } catch (err) {
    // Two sign-ups with the same email at once: the unique index catches the second.
    const cause = (err as { cause?: { code?: string } }).cause;
    if (cause?.code === "23505") throw new EmailTakenError();
    throw err;
  }
}

export async function listPendingSignups(viewer: Viewer) {
  assertAdmin(viewer);
  return db
    .select({ id: users.id, name: users.name, email: users.email, business: users.signupBusiness, createdAt: users.createdAt })
    .from(users)
    .where(and(eq(users.agencyId, viewer.agencyId), eq(users.status, "pending")))
    .orderBy(asc(users.createdAt));
}

async function loadPending(viewer: Viewer, userId: string) {
  assertAdmin(viewer);
  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, userId), eq(users.agencyId, viewer.agencyId), eq(users.status, "pending")));
  if (!user) throw new NotFoundError();
  return user;
}

/**
 * Approve a sign-up by linking it to an existing client, or to a new client
 * created from the business name they gave. Returns the client id.
 */
export async function approveSignup(viewer: Viewer, userId: string, target: { clientId: string } | { newClientName: string }) {
  const user = await loadPending(viewer, userId);
  return db.transaction(async (tx) => {
    let clientId: string;
    if ("clientId" in target) {
      clientId = await resolveClientId(viewer, target.clientId);
    } else {
      const [client] = await tx
        .insert(clients)
        .values({ agencyId: viewer.agencyId, name: target.newClientName })
        .returning({ id: clients.id });
      clientId = client.id;
    }
    await tx.update(users).set({ status: "active", clientId }).where(eq(users.id, user.id));
    return clientId;
  });
}

export async function rejectSignup(viewer: Viewer, userId: string) {
  const user = await loadPending(viewer, userId);
  await db.delete(users).where(eq(users.id, user.id));
}
