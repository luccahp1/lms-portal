import { and, eq, gt, isNull, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { clients, dashboardSsoLinks, users } from "@/db/schema";
import { randomToken, sha256 } from "@/lib/auth/crypto";
import { assertAdmin, resolveClientId, type Viewer } from "./viewer";

// One click from a client's portal into their own job dashboard, signed in. Modelled on the
// portal-to-Dash sign-in (docs/sso.md): a one-time token, good for 2 minutes, stored only as its
// sha256, redeemed by the dashboard's server, never by a browser. What differs is who redeems it:
// each dashboard is its own installation, so instead of an admin API token it holds a secret of
// its own, and a token only works with the secret of the client it was made for.

const LINK_TTL_MS = 2 * 60 * 1000;

/**
 * A new secret for a client's dashboard, shown once. Only its hash is kept, so a lost secret is
 * replaced, never read back. Replacing it signs nobody out; it only stops the old secret working.
 */
export async function rotateDashboardSsoSecret(admin: Viewer, clientId: string): Promise<string> {
  assertAdmin(admin);
  const id = await resolveClientId(admin, clientId);
  const secret = randomToken();
  await db.update(clients).set({ dashboardSsoSecretHash: sha256(secret) }).where(eq(clients.id, id));
  return secret;
}

/** Switch one-click sign-in off for a client. Their link then opens the dashboard's own login. */
export async function clearDashboardSsoSecret(admin: Viewer, clientId: string): Promise<void> {
  assertAdmin(admin);
  const id = await resolveClientId(admin, clientId);
  await db.update(clients).set({ dashboardSsoSecretHash: null }).where(eq(clients.id, id));
}

/**
 * Where "Open your dashboard" sends this person.
 *
 * A signed-in, active client user whose client has a dashboard and a secret gets the dashboard's
 * sign-in address with a fresh token. Anyone else (an admin in View as client, a client whose
 * dashboard has no secret yet) gets the plain address, where the dashboard's own login takes over.
 * Null when the client has no dashboard at all.
 */
export async function dashboardSignInUrl(viewer: Viewer): Promise<string | null> {
  if (viewer.role !== "client" || viewer.status !== "active" || !viewer.clientId) return null;
  const [client] = await db
    .select({ id: clients.id, url: clients.dashboardUrl, secret: clients.dashboardSsoSecretHash })
    .from(clients)
    .where(and(eq(clients.id, viewer.clientId), eq(clients.agencyId, viewer.agencyId)));
  if (!client?.url) return null;
  if (!client.secret) return client.url;

  const token = randomToken();
  await db.insert(dashboardSsoLinks).values({
    tokenHash: sha256(token),
    userId: viewer.userId,
    clientId: client.id,
    expiresAt: new Date(Date.now() + LINK_TTL_MS),
  });
  return `${client.url}/dashboard/sso?t=${encodeURIComponent(token)}`;
}

/**
 * Use a token once, on behalf of the dashboard holding `secret`. Returns who signed in, or null
 * when the secret matches no client, or the token is unknown, used, expired, made for another
 * client, or belongs to someone who is no longer an active user of that client.
 *
 * The token is burnt before anything else is checked, so a token tried with the wrong secret is
 * gone too: whoever holds it cannot keep guessing.
 */
export async function redeemDashboardSsoLink(secret: string, token: string): Promise<{ email: string; name: string } | null> {
  if (!secret || !token || secret.length > 200 || token.length > 200) return null;
  const [link] = await db
    .update(dashboardSsoLinks)
    .set({ usedAt: new Date() })
    .where(and(eq(dashboardSsoLinks.tokenHash, sha256(token)), isNull(dashboardSsoLinks.usedAt), gt(dashboardSsoLinks.expiresAt, new Date())))
    .returning();
  if (!link) return null;

  const [client] = await db
    .select({ id: clients.id, agencyId: clients.agencyId })
    .from(clients)
    .where(and(eq(clients.id, link.clientId), isNotNull(clients.dashboardSsoSecretHash), eq(clients.dashboardSsoSecretHash, sha256(secret))));
  if (!client) return null;

  const [user] = await db.select().from(users).where(eq(users.id, link.userId));
  if (!user || user.role !== "client" || user.status !== "active" || user.clientId !== client.id || user.agencyId !== client.agencyId) {
    return null;
  }
  return { email: user.email, name: user.name };
}
