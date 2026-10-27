import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { agencies, clients, users } from "@/db/schema";
import { assertAdmin, NotFoundError, resolveClientId, type Viewer } from "./viewer";
import { createInvite } from "./invites";

export async function getAgency(viewer: Viewer) {
  const [row] = await db.select().from(agencies).where(eq(agencies.id, viewer.agencyId));
  if (!row) throw new NotFoundError();
  return row;
}

export async function listClients(viewer: Viewer) {
  assertAdmin(viewer);
  return db.select().from(clients).where(eq(clients.agencyId, viewer.agencyId)).orderBy(asc(clients.name));
}

export async function getClient(viewer: Viewer, clientId?: string) {
  const id = await resolveClientId(viewer, clientId);
  const [row] = await db.select().from(clients).where(eq(clients.id, id));
  if (!row) throw new NotFoundError();
  return row;
}

/** People who can log in to a client's portal. */
export async function listClientUsers(viewer: Viewer, clientId: string) {
  assertAdmin(viewer);
  const id = await resolveClientId(viewer, clientId);
  return db
    .select({ id: users.id, name: users.name, email: users.email, createdAt: users.createdAt })
    .from(users)
    .where(and(eq(users.clientId, id), eq(users.agencyId, viewer.agencyId), eq(users.status, "active")))
    .orderBy(asc(users.createdAt));
}

export async function createClient(viewer: Viewer, input: { name: string; websiteUrl?: string; planName?: string }) {
  assertAdmin(viewer);
  const [client] = await db
    .insert(clients)
    .values({
      agencyId: viewer.agencyId,
      name: input.name,
      websiteUrl: input.websiteUrl || null,
      planName: input.planName || null,
    })
    .returning();
  return client;
}

export async function updateClient(
  viewer: Viewer,
  clientId: string,
  input: { name: string; websiteUrl?: string; planName?: string },
) {
  assertAdmin(viewer);
  const id = await resolveClientId(viewer, clientId);
  await db
    .update(clients)
    .set({ name: input.name, websiteUrl: input.websiteUrl || null, planName: input.planName || null })
    .where(eq(clients.id, id));
}

async function loadClientUser(viewer: Viewer, userId: string) {
  assertAdmin(viewer);
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, userId), eq(users.agencyId, viewer.agencyId), eq(users.role, "client")));
  if (!user) throw new NotFoundError();
  return user;
}

/** One-time link that lets a client set a new password (until email reset exists). */
export async function createPasswordResetLink(viewer: Viewer, userId: string) {
  const user = await loadClientUser(viewer, userId);
  return createInvite(user.id);
}

/** Remove someone's access to the portal. Their messages and requests stay. */
export async function removeClientUser(viewer: Viewer, userId: string) {
  const user = await loadClientUser(viewer, userId);
  await db.delete(users).where(eq(users.id, user.id));
}
