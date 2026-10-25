import { sql } from "drizzle-orm";
import { db } from "@/db";
import { agencies, clients, users } from "@/db/schema";
import type { Viewer } from "@/lib/data/viewer";

export async function resetDb() {
  await db.execute(sql`truncate agencies, users, sessions, invites cascade`);
}

let n = 0;

/** An agency with an admin and two clients (each with one client user). */
export async function makeAgency() {
  n++;
  const [agency] = await db.insert(agencies).values({ name: `Agency ${n}` }).returning();
  const [admin] = await db
    .insert(users)
    .values({ agencyId: agency.id, role: "agency_admin", name: "Admin", email: `admin${n}@test.local` })
    .returning();
  const made = [];
  for (const label of ["a", "b"]) {
    const [client] = await db.insert(clients).values({ agencyId: agency.id, name: `Client ${n}${label}` }).returning();
    const [user] = await db
      .insert(users)
      .values({ agencyId: agency.id, clientId: client.id, role: "client", name: "Owner", email: `client${n}${label}@test.local` })
      .returning();
    made.push({ client, viewer: toViewer(user) });
  }
  return { agency, admin: toViewer(admin), clientA: made[0]!, clientB: made[1]! };
}

function toViewer(u: typeof users.$inferSelect): Viewer {
  return { userId: u.id, agencyId: u.agencyId, role: u.role, clientId: u.clientId, name: u.name, email: u.email };
}
