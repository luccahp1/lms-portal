import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { db, pool } from "@/db";
import { ssoLinks, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { callTool } from "@/lib/mcp/protocol";
import type { Viewer } from "@/lib/data/viewer";
import { createSsoLink, redeemSsoLink } from "@/lib/data/sso";
import { homePath } from "@/lib/auth/home";
import { makeAgency, resetDb } from "./helpers";

// One login for the portal and LMS Dash (docs/sso.md).

beforeEach(resetDb);
afterEach(() => vi.unstubAllEnvs());
afterAll(() => pool.end());

async function call(viewer: Viewer, name: string, args: Record<string, unknown> = {}) {
  const result = await callTool(viewer, name, args);
  const text = result.content[0]!.text;
  return { isError: result.isError ?? false, text, data: result.isError ? undefined : JSON.parse(text) };
}

describe("signing in to LMS Dash through the portal", () => {
  it("an admin's token works once and tells Dash who it is", async () => {
    const { admin } = await makeAgency();
    const token = await createSsoLink(admin);
    const first = await call(admin, "redeem_sso_link", { token });
    expect(first.isError).toBe(false);
    expect(first.data).toEqual({ email: admin.email, name: admin.name });
    const again = await call(admin, "redeem_sso_link", { token });
    expect(again.isError).toBe(true);
  });

  it("expired tokens, other agencies and junk are refused", async () => {
    const { admin } = await makeAgency();
    const other = await makeAgency();
    const old = await createSsoLink(admin);
    await db.update(ssoLinks).set({ expiresAt: new Date(Date.now() - 1000) });
    expect(await redeemSsoLink(admin, old)).toBeNull();
    const theirs = await createSsoLink(other.admin);
    expect(await redeemSsoLink(admin, theirs)).toBeNull();
    expect((await call(admin, "redeem_sso_link", { token: "nope" })).isError).toBe(true);
  });

  it("clients can't make or redeem tokens", async () => {
    const { admin, clientA } = await makeAgency();
    await expect(createSsoLink(clientA.viewer)).rejects.toThrow();
    const token = await createSsoLink(admin);
    await expect(redeemSsoLink(clientA.viewer, token)).rejects.toThrow();
  });

  it("an admin who was switched off in between is refused", async () => {
    const { admin } = await makeAgency();
    const token = await createSsoLink(admin);
    await db.update(users).set({ status: "pending" }).where(eq(users.id, admin.userId));
    expect(await redeemSsoLink({ ...admin }, token)).toBeNull();
  });

  it("the account decides where you land", async () => {
    const { admin, clientA } = await makeAgency();
    vi.stubEnv("DASH_URL", "");
    expect(homePath(admin)).toBe("/admin");
    vi.stubEnv("DASH_URL", "https://dash.example.test/");
    expect(homePath(admin)).toBe("/sso/dash");
    expect(homePath(clientA.viewer)).toBe("/portal");
  });
});

describe("the shared design kit", () => {
  const dash = join(__dirname, "..", "..", "lms-dash", "app", "static", "kit");
  const files = ["tokens.css", "kit.css", "motion.js", "charts.js"];

  it("is here", () => {
    for (const f of files) expect(existsSync(join(__dirname, "..", "src", "kit", f))).toBe(true);
  });

  it.skipIf(!existsSync(dash))("matches LMS Dash's copy (run py scripts\\sync_kit.py in lms-dash)", () => {
    for (const f of files) {
      expect(readFileSync(join(__dirname, "..", "src", "kit", f), "utf8"), f).toBe(readFileSync(join(dash, f), "utf8"));
    }
  });
});
