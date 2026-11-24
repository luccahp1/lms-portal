import { cache } from "react";
import { and, asc, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { clients, requests, users } from "@/db/schema";
import { createRequest } from "./requests";
import { randomToken } from "@/lib/auth/crypto";
import { assertAdmin, ForbiddenError, resolveClientId, type Viewer } from "./viewer";

// Settled invoicing inside the portal (docs/settled.md). Settled is its own service: it reads the
// client's e-Transfer emails, checks Interac's signature, talks to Stripe and keeps the books.
// The portal shows its screens and calls its API for the client, with that client's owner key.
// The key never reaches a browser: only settledTarget() reads it, for the proxy route.

/** Where the Settled engine answers, e.g. http://127.0.0.1:3123. Empty: Settled is not set up here. */
export function settledUrl(): string {
  return (process.env.SETTLED_URL || "").replace(/\/+$/, "");
}

export type SettledAccess = { enabled: boolean; ready: boolean };

/** Whether this client has the add-on (enabled) and a Settled business behind it (ready). */
export const settledAccess = cache(async function settledAccess(viewer: Viewer, clientId?: string): Promise<SettledAccess> {
  const id = await resolveClientId(viewer, clientId);
  const [row] = await db.select({ enabled: clients.settledEnabled, orgId: clients.settledOrgId }).from(clients).where(eq(clients.id, id));
  return { enabled: !!row?.enabled, ready: !!row?.enabled && !!row.orgId && !!settledUrl() };
});

/** For the proxy only: the engine address and this client's key, or null when it is locked. */
export async function settledTarget(viewer: Viewer): Promise<{ base: string; key: string } | null> {
  if (viewer.role !== "client" || viewer.status !== "active" || !viewer.clientId) return null;
  const base = settledUrl();
  if (!base) return null;
  const [row] = await db
    .select({ enabled: clients.settledEnabled, key: clients.settledApiKey })
    .from(clients)
    .where(and(eq(clients.id, viewer.clientId), eq(clients.agencyId, viewer.agencyId)));
  if (!row?.enabled || !row.key) return null;
  return { base, key: row.key };
}

export class SettledError extends Error {}

async function settledJson<T>(base: string, path: string, init: RequestInit): Promise<{ data: T; res: Response }> {
  let res: Response;
  try {
    res = await fetch(base + path, { ...init, headers: { accept: "application/json", "content-type": "application/json", ...(init.headers || {}) }, cache: "no-store" });
  } catch {
    throw new SettledError("Settled did not answer at " + base + ". Is it running?");
  }
  const text = await res.text();
  const data = (text ? JSON.parse(text) : {}) as T & { error?: { message?: string } };
  if (!res.ok) throw new SettledError(data.error?.message || `Settled answered ${res.status}.`);
  return { data, res };
}

/**
 * Makes the client's Settled business: signs it up with the client's name and their first active
 * user as the owner (so payment emails reach them), then makes the owner key the portal uses.
 * The owner password is random and thrown away; the client only ever uses Settled through here.
 */
async function provision(clientId: string): Promise<{ orgId: string; key: string }> {
  const base = settledUrl();
  if (!base) throw new SettledError("Set SETTLED_URL to the Settled engine first.");
  const [client] = await db.select({ name: clients.name }).from(clients).where(eq(clients.id, clientId));
  const [owner] = await db
    .select({ email: users.email, name: users.name })
    .from(users)
    .where(and(eq(users.clientId, clientId), eq(users.status, "active"), eq(users.role, "client")))
    .orderBy(asc(users.createdAt))
    .limit(1);
  if (!client) throw new SettledError("That client was not found.");
  if (!owner) throw new SettledError("Give this client a portal login first: Settled sends payment emails to them.");

  const signup = await settledJson<{ orgId: string }>(base, "/api/auth/signup", {
    method: "POST",
    body: JSON.stringify({ businessName: client.name, name: owner.name, email: owner.email, password: randomToken() }),
  });
  const cookie = (signup.res.headers.get("set-cookie") || "").split(";")[0];
  if (!cookie.startsWith("settled_session=")) throw new SettledError("Settled made the business but did not sign in.");
  const made = await settledJson<{ key: string }>(base, "/api/v1/api-keys", {
    method: "POST",
    headers: { cookie },
    body: JSON.stringify({ name: "LMS client portal" }),
  });
  return { orgId: signup.data.orgId, key: made.data.key };
}

/**
 * Turn the add-on on or off for a client. The first time it is turned on, their Settled business
 * is made. Turning it off keeps that business and everything in it; on again picks it back up.
 */
export async function setSettledEnabled(admin: Viewer, clientId: string, enabled: boolean): Promise<SettledAccess> {
  assertAdmin(admin);
  const id = await resolveClientId(admin, clientId);
  const [row] = await db.select({ orgId: clients.settledOrgId }).from(clients).where(eq(clients.id, id));
  if (enabled && !row?.orgId) {
    const { orgId, key } = await provision(id);
    await db.update(clients).set({ settledEnabled: true, settledOrgId: orgId, settledApiKey: key }).where(eq(clients.id, id));
  } else {
    await db.update(clients).set({ settledEnabled: enabled }).where(eq(clients.id, id));
  }
  return settledAccess(admin, id);
}

/** A client asking for the add-on. Kept separate so the locked page can't do anything else. */
export function assertCanAsk(viewer: Viewer) {
  if (viewer.role !== "client" || viewer.previewBy) throw new ForbiddenError();
}

export const SETTLED_REQUEST_TITLE = "Switch on Invoicing (Settled)";

/**
 * The locked page's button: files a request so LMS sees it in Dash. Asking twice while one is still
 * open just returns that one. Refused in "View as client".
 */
export async function askForSettled(viewer: Viewer): Promise<{ requestId: string; already: boolean }> {
  assertCanAsk(viewer);
  const id = await resolveClientId(viewer);
  const [open] = await db
    .select({ id: requests.id })
    .from(requests)
    .where(and(eq(requests.clientId, id), eq(requests.title, SETTLED_REQUEST_TITLE), ne(requests.status, "done")));
  if (open) return { requestId: open.id, already: true };
  const requestId = await createRequest(viewer, {
    title: SETTLED_REQUEST_TITLE,
    details: "I'd like Settled invoicing on my account: invoices that mark themselves paid when an e-Transfer, card payment or cheque comes in.",
  });
  return { requestId, already: false };
}
