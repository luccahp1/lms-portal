import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
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
