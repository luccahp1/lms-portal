import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db";
import { ssoLinks, users } from "@/db/schema";
import { randomToken, sha256 } from "@/lib/auth/crypto";
import { assertAdmin, type Viewer } from "./viewer";

// One login for the portal and LMS Dash. Everyone signs in on the portal; an agency admin is
// then sent on to Dash with a one-time token that Dash swaps for its own session. Clients never
// get a token, so they can't reach Dash. docs/sso.md has the whole flow.

const LINK_TTL_MS = 2 * 60 * 1000;

export async function createSsoLink(admin: Viewer): Promise<string> {
  assertAdmin(admin);
  const token = randomToken();
  await db.insert(ssoLinks).values({ tokenHash: sha256(token), userId: admin.userId, expiresAt: new Date(Date.now() + LINK_TTL_MS) });
  return token;
}

/**
 * Use a token once. Called by LMS Dash with its admin API token. Returns who signed in, or null
 * when the token is unknown, used, expired, or belongs to someone who is no longer an active admin
 * of the caller's agency.
 */
export async function redeemSsoLink(caller: Viewer, token: string): Promise<{ email: string; name: string } | null> {
  assertAdmin(caller);
  const [link] = await db
    .update(ssoLinks)
    .set({ usedAt: new Date() })
    .where(and(eq(ssoLinks.tokenHash, sha256(token)), isNull(ssoLinks.usedAt), gt(ssoLinks.expiresAt, new Date())))
    .returning();
  if (!link) return null;
  const [user] = await db.select().from(users).where(eq(users.id, link.userId));
  if (!user || user.role !== "agency_admin" || user.status !== "active" || user.agencyId !== caller.agencyId) return null;
  return { email: user.email, name: user.name };
}
