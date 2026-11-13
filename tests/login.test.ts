import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db, pool } from "@/db";
import { users } from "@/db/schema";
import * as crypto from "@/lib/auth/crypto";
import { attemptLogin, clientKey, resetLoginThrottle } from "@/lib/auth/login";
import { makeAgency, resetDb } from "./helpers";

const PASSWORD = "a-long-password";

beforeEach(async () => {
  await resetDb();
  resetLoginThrottle();
});
afterAll(() => pool.end());

async function adminWithPassword() {
  const { admin } = await makeAgency();
  await db.update(users).set({ passwordHash: await crypto.hashPassword(PASSWORD) }).where(eq(users.id, admin.userId));
  return admin;
}

describe("signing in", () => {
  it("takes the right password and refuses a wrong one", async () => {
    const admin = await adminWithPassword();
    expect(await attemptLogin(admin.email, "wrong-password", "1.1.1.1")).toEqual({ ok: false, reason: "mismatch" });
    expect(await attemptLogin(admin.email.toUpperCase(), PASSWORD, "1.1.1.1")).toEqual({ ok: true, userId: admin.userId });
  });

  it("locks an address out after ten wrong tries, even with the right password", async () => {
    const admin = await adminWithPassword();
    for (let i = 0; i < 10; i++) {
      expect((await attemptLogin(admin.email, `guess-${i}`, "2.2.2.2")).ok).toBe(false);
    }
    expect(await attemptLogin(admin.email, PASSWORD, "2.2.2.2")).toEqual({ ok: false, reason: "throttled" });
    // Somebody else on another address is not locked out with them.
    expect((await attemptLogin(admin.email, PASSWORD, "3.3.3.3")).ok).toBe(true);
  });

  it("slows guessing at one account from many addresses", async () => {
    const admin = await adminWithPassword();
    for (let i = 0; i < 30; i++) await attemptLogin(admin.email, "guess", `10.0.0.${i}`);
    expect(await attemptLogin(admin.email, PASSWORD, "10.9.9.9")).toEqual({ ok: false, reason: "throttled" });
  });

  it("lets the tries go after the window", async () => {
    const admin = await adminWithPassword();
    const start = Date.now();
    for (let i = 0; i < 10; i++) await attemptLogin(admin.email, "guess", "4.4.4.4", start);
    expect((await attemptLogin(admin.email, PASSWORD, "4.4.4.4", start + 60_000)).ok).toBe(false);
    expect((await attemptLogin(admin.email, PASSWORD, "4.4.4.4", start + 16 * 60_000)).ok).toBe(true);
  });

  it("a good sign-in clears that address's count", async () => {
    const admin = await adminWithPassword();
    for (let i = 0; i < 9; i++) await attemptLogin(admin.email, "guess", "5.5.5.5");
    expect((await attemptLogin(admin.email, PASSWORD, "5.5.5.5")).ok).toBe(true);
    for (let i = 0; i < 9; i++) await attemptLogin(admin.email, "guess", "5.5.5.5");
    expect((await attemptLogin(admin.email, PASSWORD, "5.5.5.5")).ok).toBe(true);
  });

  it("does the same work for an unknown email as for a known one", async () => {
    const admin = await adminWithPassword();
    const verify = vi.spyOn(crypto, "verifyPassword");
    await attemptLogin(admin.email, "wrong-password", "6.6.6.6");
    await attemptLogin("nobody@test.local", "wrong-password", "6.6.6.6");
    expect(verify).toHaveBeenCalledTimes(2);
    verify.mockRestore();
  });
});

describe("whose address a sign-in counts against", () => {
  it("trusts the header Cloudflare sets over one a browser can send", () => {
    expect(clientKey(new Headers({ "cf-connecting-ip": "9.9.9.9", "x-forwarded-for": "1.2.3.4" }))).toBe("9.9.9.9");
    expect(clientKey(new Headers({ "x-forwarded-for": "1.2.3.4, 9.9.9.9" }))).toBe("9.9.9.9");
    expect(clientKey(new Headers())).toBe("local");
  });
});
