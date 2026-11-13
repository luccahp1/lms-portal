import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, pool } from "@/db";
import { clients, dashboardSsoLinks, users } from "@/db/schema";
import * as clientsData from "@/lib/data/clients";
import { ForbiddenError } from "@/lib/data/viewer";
import { dashboardSignInUrl, redeemDashboardSsoLink, rotateDashboardSsoSecret } from "@/lib/data/dashboard-sso";
import { POST } from "@/app/api/dashboard-sso/redeem/route";
import { makeAgency, resetDb } from "./helpers";

// One click from a client's portal into their own job dashboard (docs/sso.md).

beforeEach(resetDb);
afterAll(() => pool.end());

async function setUp() {
  const agency = await makeAgency();
  await clientsData.setClientDashboard(agency.admin, agency.clientA.client.id, "https://acme.example.com");
  const secret = await rotateDashboardSsoSecret(agency.admin, agency.clientA.client.id);
  return { ...agency, secret };
}

const tokenOf = (url: string) => new URL(url).searchParams.get("t")!;

describe("signing a client in to their own dashboard", () => {
  it("a token works once, with that client's secret, and says who it is", async () => {
    const { clientA, secret } = await setUp();
    const url = (await dashboardSignInUrl(clientA.viewer))!;
    expect(url.startsWith("https://acme.example.com/dashboard/sso?t=")).toBe(true);
    const token = tokenOf(url);

    expect(await redeemDashboardSsoLink(secret, token)).toEqual({ email: clientA.viewer.email, name: clientA.viewer.name });
    expect(await redeemDashboardSsoLink(secret, token)).toBeNull();
  });

  it("stores only the hashes: neither the token nor the secret is in the database", async () => {
    const { clientA, secret } = await setUp();
    const token = tokenOf((await dashboardSignInUrl(clientA.viewer))!);
    const rows = JSON.stringify([await db.select().from(dashboardSsoLinks), await db.select().from(clients)]);
    expect(rows).not.toContain(token);
    expect(rows).not.toContain(secret);
    // And no page reads the secret's hash.
    expect(JSON.stringify(await clientsData.getClient(clientA.viewer))).not.toContain("dashboardSso");
  });

  it("refuses an expired token, another client's secret, a replaced secret and junk", async () => {
    const { admin, clientA, clientB, secret } = await setUp();
    const old = tokenOf((await dashboardSignInUrl(clientA.viewer))!);
    await db.update(dashboardSsoLinks).set({ expiresAt: new Date(Date.now() - 1000) });
    expect(await redeemDashboardSsoLink(secret, old)).toBeNull();

    await clientsData.setClientDashboard(admin, clientB.client.id, "https://other.example.com");
    const otherSecret = await rotateDashboardSsoSecret(admin, clientB.client.id);
    const mine = tokenOf((await dashboardSignInUrl(clientA.viewer))!);
    expect(await redeemDashboardSsoLink(otherSecret, mine)).toBeNull();
    // Burnt by the wrong try: the right secret cannot use it afterwards either.
    expect(await redeemDashboardSsoLink(secret, mine)).toBeNull();

    const fresh = tokenOf((await dashboardSignInUrl(clientA.viewer))!);
    await rotateDashboardSsoSecret(admin, clientA.client.id);
    expect(await redeemDashboardSsoLink(secret, fresh)).toBeNull();

    expect(await redeemDashboardSsoLink("", "")).toBeNull();
    expect(await redeemDashboardSsoLink(secret, "nope")).toBeNull();
  });

  it("refuses a client user switched off after the token was made", async () => {
    const { clientA, secret } = await setUp();
    const token = tokenOf((await dashboardSignInUrl(clientA.viewer))!);
    await db.update(users).set({ status: "pending" }).where(eq(users.id, clientA.viewer.userId));
    expect(await redeemDashboardSsoLink(secret, token)).toBeNull();
  });

  it("gives admins and clients without a secret the plain address, never a token", async () => {
    const { admin, clientA, clientB } = await setUp();
    expect(await dashboardSignInUrl(admin)).toBeNull();
    expect(await dashboardSignInUrl({ ...clientA.viewer, status: "pending" })).toBeNull();
    await clientsData.setClientDashboard(admin, clientB.client.id, "https://other.example.com");
    expect(await dashboardSignInUrl(clientB.viewer)).toBe("https://other.example.com");
    expect(await db.select().from(dashboardSsoLinks)).toHaveLength(0);
  });

  it("only an admin of the same agency can make a secret", async () => {
    const { clientA } = await setUp();
    const other = await makeAgency();
    await expect(rotateDashboardSsoSecret(clientA.viewer, clientA.client.id)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(rotateDashboardSsoSecret(other.admin, clientA.client.id)).rejects.toThrow();
  });

  it("the redeem endpoint answers the same 401 to every failure and the person to a good request", async () => {
    const { clientA, secret } = await setUp();
    const token = tokenOf((await dashboardSignInUrl(clientA.viewer))!);
    const ask = (auth: string, body: unknown) =>
      POST(new Request("https://portal.example/api/dashboard-sso/redeem", { method: "POST", headers: { authorization: auth, "content-type": "application/json" }, body: JSON.stringify(body) }));

    const noAuth = await ask("", { token });
    expect(noAuth.status).toBe(401);
    expect(await noAuth.json()).toEqual({ error: "invalid" });

    const fresh = tokenOf((await dashboardSignInUrl(clientA.viewer))!);
    const ok = await ask("Bearer " + secret, { token: fresh });
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ email: clientA.viewer.email, name: clientA.viewer.name });
    expect((await ask("Bearer " + secret, { token: fresh })).status).toBe(401);
    expect((await ask("Bearer " + secret, "not json")).status).toBe(401);

  });
});
