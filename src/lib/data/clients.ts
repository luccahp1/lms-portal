import { cache } from "react";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { agencies, clients, users } from "@/db/schema";
import { assertAdmin, NotFoundError, resolveClientId, type Viewer } from "./viewer";
import { createInvite } from "./invites";

export const getAgency = cache(async function getAgency(viewer: Viewer) {
  const [row] = await db.select().from(agencies).where(eq(agencies.id, viewer.agencyId));
  if (!row) throw new NotFoundError();
  return row;
});

// Every client column except the stats token, which never leaves the server.
const clientColumns = {
  id: clients.id,
  agencyId: clients.agencyId,
  name: clients.name,
  websiteUrl: clients.websiteUrl,
  planName: clients.planName,
  monthlyCents: clients.monthlyCents,
  creditCents: clients.creditCents,
  statsUrl: clients.statsUrl,
  dashboardUrl: clients.dashboardUrl,
  createdAt: clients.createdAt,
};

export const listClients = cache(async function listClients(viewer: Viewer) {
  assertAdmin(viewer);
  return db.select(clientColumns).from(clients).where(eq(clients.agencyId, viewer.agencyId)).orderBy(asc(clients.name));
});

export const getClient = cache(async function getClient(viewer: Viewer, clientId?: string) {
  const id = await resolveClientId(viewer, clientId);
  const [row] = await db.select(clientColumns).from(clients).where(eq(clients.id, id));
  if (!row) throw new NotFoundError();
  return row;
});

export async function setPaymentInstructions(viewer: Viewer, text: string) {
  assertAdmin(viewer);
  await db.update(agencies).set({ paymentInstructions: text.trim() }).where(eq(agencies.id, viewer.agencyId));
}

export class EmailTakenError extends Error {
  constructor() {
    super("Someone already uses that email address");
  }
}

/**
 * Give someone a login to a client's portal without the sign-up step. Returns a one-time
 * link (14 days) for them to choose their own password. Nothing is emailed.
 */
export async function createClientUser(viewer: Viewer, clientId: string, input: { email: string; name: string }) {
  assertAdmin(viewer);
  const id = await resolveClientId(viewer, clientId);
  const email = input.email.trim().toLowerCase();
  const [taken] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (taken) throw new EmailTakenError();
  const [user] = await db
    .insert(users)
    .values({ agencyId: viewer.agencyId, clientId: id, role: "client", status: "active", email, name: input.name.trim() })
    .returning({ id: users.id });
  return { userId: user!.id, token: await createInvite(user!.id) };
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

// The link is rendered to the client as a button, so only a plain https address is stored:
// no credentials in it, no javascript: or http: targets.
export function cleanDashboardUrl(input: string | null | undefined): string | null {
  const text = (input ?? "").trim();
  if (!text) return null;
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    throw new Error("That doesn't look like a web address. It should start with https://");
  }
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error("The dashboard link must be a plain https:// address.");
  }
  return url.origin + (url.pathname === "/" ? "" : url.pathname.replace(/\/+$/, ""));
}

// Set or clear (empty) the link to the client's own job dashboard.
export async function setClientDashboard(viewer: Viewer, clientId: string, dashboardUrl: string | null | undefined) {
  assertAdmin(viewer);
  const id = await resolveClientId(viewer, clientId);
  const clean = cleanDashboardUrl(dashboardUrl);
  await db.update(clients).set({ dashboardUrl: clean }).where(eq(clients.id, id));
  return clean;
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
