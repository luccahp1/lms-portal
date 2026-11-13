import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import * as crypto from "./crypto";

// Checking a password, with a limit on wrong tries. The portal's sign-in page is public and is
// the one door into both the portal and LMS Dash, so guessing has to cost something.
//
// Counted in memory: the portal is one Node process, and a restart forgetting the counts is a
// small price next to a table written on every wrong password. Two counts, both over 15 minutes:
// per address (a person mistyping) and per email (one account guessed at from many addresses).
// The per-email limit is the looser one, since anyone can run it up against somebody else's email.

const WINDOW_MS = 15 * 60 * 1000;
const MAX_PER_ADDRESS = 10;
const MAX_PER_EMAIL = 30;
const MAX_KEYS = 10_000;

const failures = new Map<string, number[]>();

function recent(key: string, now: number): number[] {
  const kept = (failures.get(key) ?? []).filter((at) => now - at < WINDOW_MS);
  if (kept.length) failures.set(key, kept);
  else failures.delete(key);
  return kept;
}

function note(key: string, now: number) {
  if (failures.size >= MAX_KEYS) {
    for (const k of [...failures.keys()]) recent(k, now);
  }
  failures.set(key, [...recent(key, now), now]);
}

/** Test seam. */
export function resetLoginThrottle() {
  failures.clear();
}

/**
 * The address a sign-in counts against. Cloudflare sets `cf-connecting-ip` itself, so a browser
 * cannot choose it. Without it (local dev, a request that skipped the tunnel) the last hop of
 * `x-forwarded-for` is the one the nearest proxy wrote; the first is whatever the sender typed.
 */
export function clientKey(headers: Headers): string {
  const cf = headers.get("cf-connecting-ip")?.trim();
  if (cf) return cf.slice(0, 60);
  const hops = (headers.get("x-forwarded-for") ?? "").split(",").map((h) => h.trim()).filter(Boolean);
  return (hops[hops.length - 1] ?? "local").slice(0, 60);
}

let decoy: Promise<string> | undefined;

export type LoginResult = { ok: true; userId: string } | { ok: false; reason: "mismatch" | "throttled" };

/**
 * One sign-in try. The same answer and the same work for an unknown email as for a wrong
 * password: an account that does not exist is checked against a throwaway hash, so the reply
 * does not come back faster and give away which emails have accounts.
 */
export async function attemptLogin(email: string, password: string, address: string, now = Date.now()): Promise<LoginResult> {
  const emailKey = `email:${email.trim().toLowerCase()}`;
  const addressKey = `addr:${address}`;
  if (recent(addressKey, now).length >= MAX_PER_ADDRESS || recent(emailKey, now).length >= MAX_PER_EMAIL) {
    return { ok: false, reason: "throttled" };
  }

  const [user] = await db
    .select({ id: users.id, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.email, email.trim().toLowerCase()));
  decoy ??= crypto.hashPassword("no account has this password");
  const matches = await crypto.verifyPassword(password, user?.passwordHash ?? (await decoy));
  if (!user?.passwordHash || !matches) {
    note(addressKey, now);
    note(emailKey, now);
    return { ok: false, reason: "mismatch" };
  }
  failures.delete(addressKey);
  return { ok: true, userId: user.id };
}
