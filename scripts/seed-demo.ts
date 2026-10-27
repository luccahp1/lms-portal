// Dev only: a demo agency with one client and sample content.
// Logins: admin@demo.test / demo-password, client@demo.test / demo-password

import { db, pool } from "@/db";
import { agencies, clients, invoices, messages, monthlyNotes, requests, users, workLog } from "@/db/schema";
import { hashPassword } from "@/lib/auth/crypto";

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Refusing to seed demo data in production");
  const passwordHash = await hashPassword("demo-password");

  const [agency] = await db.insert(agencies).values({ name: "Demo Agency" }).returning();
  const [admin] = await db
    .insert(users)
    .values({ agencyId: agency.id, role: "agency_admin", name: "Alex Admin", email: "admin@demo.test", passwordHash })
    .returning();
  const [client] = await db
    .insert(clients)
    .values({ agencyId: agency.id, name: "Sample Client Co.", websiteUrl: "https://example.com", planName: "Website Care" })
    .returning();
  const [contact] = await db
    .insert(users)
    .values({ agencyId: agency.id, clientId: client.id, role: "client", name: "Sam Client", email: "client@demo.test", passwordHash })
    .returning();

  const ids = { agencyId: agency.id, clientId: client.id };
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

  await db.insert(monthlyNotes).values({
    ...ids,
    month,
    authorId: admin.id,
    wins: "New services page went live\nContact form fixed on mobile\nSecurity updates and backups",
    workingOn: "Adding your team photo to the About page.",
    nextMonth: "A customer reviews section on the homepage.",
  });
  await db.insert(workLog).values([
    { ...ids, title: "New services page went live", tag: "Content", doneOn: daysAgo(3) },
    { ...ids, title: "Fixed the contact form on mobile", tag: "Fix", doneOn: daysAgo(7) },
    { ...ids, title: "Security and software updates", tag: "Maintenance", doneOn: daysAgo(11) },
  ]);
  await db.insert(requests).values([
    { ...ids, title: "Change holiday hours banner", status: "review", createdById: contact.id },
    { ...ids, title: "Add team photo to About page", status: "in_progress", createdById: contact.id },
    { ...ids, title: "Update prices on Services page", status: "done", createdById: contact.id },
  ]);
  await db.insert(messages).values([
    { ...ids, authorId: admin.id, body: "Hi! The new services page is live. Have a look when you get a minute." },
    { ...ids, authorId: contact.id, body: "Looks great. Can we add a team photo to the About page?" },
  ]);
  await db.insert(invoices).values([
    { ...ids, number: "INV-0002", description: "Website Care, this month", amountCents: 15000, issuedOn: daysAgo(1), dueOn: daysAgo(-14), status: "sent" },
    { ...ids, number: "INV-0001", description: "Website Care, last month", amountCents: 15000, issuedOn: daysAgo(31), dueOn: daysAgo(17), status: "paid" },
  ]);

  console.log("Seeded demo data.");
  console.log("Admin:  admin@demo.test / demo-password");
  console.log("Client: client@demo.test / demo-password");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
