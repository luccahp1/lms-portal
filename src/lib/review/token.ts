import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { NoteSource } from "./describe";

// The review frame (/site/<token>/...) can't use the session cookie: the framed page is
// sandboxed, so the browser treats every request it makes as coming from another site and
// leaves the cookie out. The page that embeds the frame checks the session and hands it a
// signed token instead, which names one client and one source and lasts half a day.
//
// REVIEW_SECRET keeps tokens valid across restarts. Without it each process makes its own
// secret: an open review frame stops loading after a restart until the page is reloaded.

const TTL_SECONDS = 12 * 60 * 60;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const g = globalThis as unknown as { reviewSecret?: string };

function secret() {
  return process.env.REVIEW_SECRET || (g.reviewSecret ??= randomBytes(32).toString("hex"));
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url").slice(0, 32);
}

export type ReviewClaim = { clientId: string; source: NoteSource };

export function mintReviewToken(claim: ReviewClaim, now = Date.now()): string {
  const payload = `${claim.clientId}.${claim.source === "template" ? "t" : "s"}.${Math.floor(now / 1000) + TTL_SECONDS}`;
  return `${payload}.${sign(payload)}`;
}

export function verifyReviewToken(token: string, now = Date.now()): ReviewClaim | null {
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [clientId, kind, exp, mac] = parts as [string, string, string, string];
  if (!UUID.test(clientId) || (kind !== "s" && kind !== "t") || !/^\d{9,12}$/.test(exp)) return null;
  const want = Buffer.from(sign(`${clientId}.${kind}.${exp}`));
  const got = Buffer.from(mac);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  if (Number(exp) * 1000 < now) return null;
  return { clientId, source: kind === "t" ? "template" : "site" };
}
