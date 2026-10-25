// Bootstrap: create an agency and its first admin, then print an invite link
// the admin opens to set their password.
//
//   npm run create-admin -- "Agency Name" "Your Name" you@example.com
//   npm run create-admin -- --agency <agency-id> "Teammate Name" teammate@example.com

import { eq } from "drizzle-orm";
import { db, pool } from "@/db";
import { agencies, users } from "@/db/schema";
import { createInvite } from "@/lib/data/invites";

async function main() {
  const args = process.argv.slice(2);
  let agencyId: string;
  let name: string;
  let email: string;

  if (args[0] === "--agency") {
    [, agencyId, name, email] = args;
    const [agency] = await db.select().from(agencies).where(eq(agencies.id, agencyId ?? ""));
    if (!agency) throw new Error(`No agency with id ${agencyId}`);
  } else {
    const [agencyName] = args;
    [, name, email] = args;
    if (!agencyName) throw new Error("Usage: create-admin <agency name> <your name> <email>");
    const [agency] = await db.insert(agencies).values({ name: agencyName }).returning();
    agencyId = agency.id;
    console.log(`Created agency "${agency.name}" (${agency.id})`);
  }
  if (!name || !email) throw new Error("Name and email are required");

  const [user] = await db
    .insert(users)
    .values({ agencyId, role: "agency_admin", name, email: email.toLowerCase() })
    .returning();
  const token = await createInvite(user.id);
  const base = process.env.APP_URL || "http://localhost:3000";
  console.log(`Created admin ${user.email}`);
  console.log(`Set your password here (link valid 14 days): ${base}/reset/${token}`);
}

main()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
