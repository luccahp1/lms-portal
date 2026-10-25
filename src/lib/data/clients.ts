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

export async function listClientUsers(viewer: Viewer, clientId: string) {
  assertAdmin(viewer);
  const id = await resolveClientId(viewer, clientId);
  return db
    .select({ id: users.id, name: users.name, email: users.email, activated: users.passwordHash })
    .from(users)
    .where(and(eq(users.clientId, id), eq(users.agencyId, viewer.agencyId)))
    .then((rows) => rows.map((r) => ({ ...r, activated: r.activated !== null })));
}

export async function createClient(
  viewer: Viewer,
  input: { name: string; websiteUrl?: string; planName?: string; contactName: string; contactEmail: string },
) {
  assertAdmin(viewer);
  return db.transaction(async (tx) => {
    const [client] = await tx
      .insert(clients)
      .values({
        agencyId: viewer.agencyId,
        name: input.name,
        websiteUrl: input.websiteUrl || null,
        planName: input.planName || null,
      })
      .returning();
    const [user] = await tx
      .insert(users)
      .values({
        agencyId: viewer.agencyId,
        clientId: client.id,
        role: "client",
        name: input.contactName,
        email: input.contactEmail.toLowerCase(),
      })
      .returning();
    const token = await createInvite(user.id, tx);
    return { client, user, inviteToken: token };
  });
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

/** New invite link for a client contact (e.g. the first one expired). */
export async function reinviteClientUser(viewer: Viewer, userId: string) {
  assertAdmin(viewer);
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, userId), eq(users.agencyId, viewer.agencyId), eq(users.role, "client")));
  if (!user) throw new NotFoundError();
  return createInvite(user.id);
}
