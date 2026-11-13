import { createHmac } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { clients } from "@/db/schema";

// Tells LMS Dash about ticket activity the moment it happens, so the agency side doesn't poll.
// POST LMS_DASH_WEBHOOK_URL, body JSON, header X-LMS-Signature: sha256=<HMAC of the body with
// LMS_DASH_WEBHOOK_SECRET>. Fire and forget: a down Dash never breaks a client's request.
// Dash also resyncs every few minutes with list_request_activity, so a missed call heals.

export type RequestEvent = "request.created" | "request.updated" | "request.commented" | "request.deleted";
/** Client activity outside tickets, so the client's portal tab in Dash stays current. */
export type ActivityEvent =
  | "message.created"
  | "file.uploaded"
  | "file.responded"
  | "todo.updated"
  | "signup.created"
  // A new client picked a design or sent their answers, or made their login from the start link.
  | "intake.updated"
  | "start.claimed";

export function sign(body: string, secret: string) {
  return "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
}

export function notifyDash(
  event: RequestEvent,
  request: { id: string; clientId: string; title: string; status: string },
): void {
  send(event, request.clientId, { requestId: request.id, title: request.title, status: request.status });
}

/** Anything else a client did: Dash refreshes that client's portal tab. clientId is null for a sign-up. */
export function notifyDashActivity(event: ActivityEvent, clientId: string | null, extra: Record<string, string> = {}): void {
  send(event, clientId, extra);
}

function send(event: RequestEvent | ActivityEvent, clientId: string | null, extra: Record<string, string>) {
  const url = process.env.LMS_DASH_WEBHOOK_URL;
  const secret = process.env.LMS_DASH_WEBHOOK_SECRET;
  if (!url || !secret) return;
  void (async () => {
    const [client] = clientId
      ? await db.select({ name: clients.name }).from(clients).where(eq(clients.id, clientId))
      : [];
    const body = JSON.stringify({ event, clientId, clientName: client?.name ?? "", ...extra, at: new Date().toISOString() });
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-LMS-Signature": sign(body, secret) },
      body,
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) console.warn(`LMS Dash webhook ${event}: ${res.status}`);
  })().catch((err) => console.warn("LMS Dash webhook failed:", err instanceof Error ? err.message : err));
}
