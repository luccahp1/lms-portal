import { and, asc, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db";
import { previewLinks, previewSessions, users } from "@/db/schema";
import { randomToken, sha256 } from "@/lib/auth/crypto";
import { assertAdmin, resolveClientId, type Viewer } from "./viewer";

// Stands in for the client user when a client has nobody who can log in yet,
// so nothing in the portal counts as "yours".
export const NOBODY_ID = "00000000-0000-0000-0000-000000000000";

/**
 * The viewer an admin sees the portal as when they open "View as client".
 * Picks the given client user, else the client's first active user, else a
 * placeholder. Only used to render portal pages: server actions still run as
 * the admin, and the preview UI disables every form.
 */
export async function previewViewer(admin: Viewer, clientId: string, userId?: string): Promise<Viewer> {
  assertAdmin(admin);
  const id = await resolveClientId(admin, clientId);
  const people = await db
    .select({ userId: users.id, name: users.name, email: users.email })
    .from(users)
    .where(and(eq(users.clientId, id), eq(users.role, "client"), eq(users.status, "active")))
    .orderBy(asc(users.createdAt));
  const person = people.find((p) => p.userId === userId) ?? people[0];
  return {
    ...(person ?? { userId: NOBODY_ID, name: "Client (nobody has joined yet)", email: "" }),
    agencyId: admin.agencyId,
    role: "client",
    status: "active",
    clientId: id,
    previewBy: admin.name,
  };
}

// ---- "View as client" from LMS Dash ----
// Dash has no portal session, so it asks (over MCP) for a one-time link. Opening it swaps the
// link for a preview-only session cookie: /portal pages for that one client, nothing else.

const LINK_TTL_MS = 2 * 60 * 1000;
export const PREVIEW_SESSION_TTL_MS = 60 * 60 * 1000;

export async function createPreviewLink(admin: Viewer, clientId: string, userId?: string): Promise<string> {
  // Validates the client (and person) the same way the admin button does.
  const as = await previewViewer(admin, clientId, userId);
  const token = randomToken();
  await db.insert(previewLinks).values({
    tokenHash: sha256(token),
    adminId: admin.userId,
    clientId: as.clientId!,
    asUserId: as.userId === NOBODY_ID ? null : as.userId,
    expiresAt: new Date(Date.now() + LINK_TTL_MS),
  });
  return token;
}

/** Use a link once. Returns the preview session token to put in the cookie, or null. */
export async function redeemPreviewLink(token: string): Promise<string | null> {
  const [link] = await db
    .update(previewLinks)
    .set({ usedAt: new Date() })
    .where(and(eq(previewLinks.tokenHash, sha256(token)), isNull(previewLinks.usedAt), gt(previewLinks.expiresAt, new Date())))
    .returning();
  if (!link) return null;
  const session = randomToken();
  await db.insert(previewSessions).values({
    id: sha256(session),
    adminId: link.adminId,
    clientId: link.clientId,
    asUserId: link.asUserId,
    expiresAt: new Date(Date.now() + PREVIEW_SESSION_TTL_MS),
  });
  return session;
}

/** The client viewer for a preview session cookie, while it and its admin are still valid. */
export async function previewSessionViewer(token: string): Promise<Viewer | null> {
  const [row] = await db
    .select({ s: previewSessions, admin: users })
    .from(previewSessions)
    .innerJoin(users, eq(users.id, previewSessions.adminId))
    .where(and(eq(previewSessions.id, sha256(token)), gt(previewSessions.expiresAt, new Date())));
  if (!row || row.admin.role !== "agency_admin" || row.admin.status !== "active") return null;
  const admin: Viewer = {
    userId: row.admin.id,
    agencyId: row.admin.agencyId,
    role: "agency_admin",
    status: "active",
    clientId: null,
    name: row.admin.name,
    email: row.admin.email,
  };
  try {
    return await previewViewer(admin, row.s.clientId, row.s.asUserId ?? undefined);
  } catch {
    return null;
  }
}

export async function endPreviewSession(token: string) {
  await db.delete(previewSessions).where(eq(previewSessions.id, sha256(token)));
}
