import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { eq } from "drizzle-orm";
import { db, pool } from "@/db";
import { requests, users } from "@/db/schema";
import * as clientsData from "@/lib/data/clients";
import { ForbiddenError } from "@/lib/data/viewer";
import { askForSettled, setSettledEnabled, settledAccess, settledTarget, SETTLED_REQUEST_TITLE } from "@/lib/data/settled";
import { makeAgency, resetDb } from "./helpers";

// Invoicing (Settled) as a portal add-on (docs/settled.md). A fake Settled engine on a local port
// stands in for the real one: it takes the sign-up and hands out an owner key.

const seen: { path: string; body: Record<string, unknown>; cookie?: string }[] = [];
let n = 0;
const fake = http.createServer((req, res) => {
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    const body = raw ? JSON.parse(raw) : {};
    seen.push({ path: req.url!, body, cookie: req.headers.cookie });
    res.setHeader("content-type", "application/json");
    if (req.url === "/api/auth/signup") {
      if (body.email === "taken@test.local") {
        res.statusCode = 409;
        return res.end(JSON.stringify({ error: { code: "taken", message: "That email already has an account." } }));
      }
      n++;
      res.statusCode = 201;
      res.setHeader("set-cookie", `settled_session=sess${n}; Path=/; HttpOnly`);
      return res.end(JSON.stringify({ orgId: `org_${n}`, userId: `usr_${n}` }));
    }
    if (req.url === "/api/v1/api-keys" && req.headers.cookie === `settled_session=sess${n}`) {
      res.statusCode = 201;
      return res.end(JSON.stringify({ id: `key_${n}`, key: `stl_live_secretkey_${n}`, name: body.name }));
    }
    res.statusCode = 401;
    res.end(JSON.stringify({ error: { code: "unauthenticated", message: "Please sign in." } }));
  });
});

beforeAll(async () => {
  await new Promise<void>((r) => fake.listen(0, "127.0.0.1", r));
  process.env.SETTLED_URL = `http://127.0.0.1:${(fake.address() as AddressInfo).port}/`;
});
beforeEach(async () => {
  seen.length = 0;
  await resetDb();
});
afterAll(async () => {
  fake.close();
  await pool.end();
});

describe("Invoicing add-on", () => {
  it("is locked until an admin switches it on", async () => {
    const { clientA } = await makeAgency();
    expect(await settledAccess(clientA.viewer)).toEqual({ enabled: false, ready: false });
    expect(await settledTarget(clientA.viewer)).toBeNull();
  });

  it("switching it on makes the client's Settled business with their portal user as owner", async () => {
    const { admin, clientA } = await makeAgency();
    expect(await setSettledEnabled(admin, clientA.client.id, true)).toEqual({ enabled: true, ready: true });

    const signup = seen.find((s) => s.path === "/api/auth/signup")!;
    expect(signup.body).toMatchObject({ businessName: clientA.client.name, email: clientA.viewer.email, name: clientA.viewer.name });
    const keyCall = seen.find((s) => s.path === "/api/v1/api-keys")!;
    expect(keyCall.cookie).toBe("settled_session=sess" + n);

    const target = await settledTarget(clientA.viewer);
    expect(target).toEqual({ base: process.env.SETTLED_URL!.replace(/\/$/, ""), key: "stl_live_secretkey_" + n });
  });

  it("each client only ever reaches its own business", async () => {
    const { admin, clientA, clientB } = await makeAgency();
    await setSettledEnabled(admin, clientA.client.id, true);
    expect(await settledTarget(clientB.viewer)).toBeNull();
    await setSettledEnabled(admin, clientB.client.id, true);
    const a = await settledTarget(clientA.viewer);
    const b = await settledTarget(clientB.viewer);
    expect(a!.key).not.toBe(b!.key);
    // An admin never gets a key through the proxy lookup, even for their own clients.
    expect(await settledTarget(admin)).toBeNull();
  });

  it("the key never shows on a page and other agencies can't switch it on", async () => {
    const { admin, clientA } = await makeAgency();
    const other = await makeAgency();
    await setSettledEnabled(admin, clientA.client.id, true);
    expect(JSON.stringify(await clientsData.getClient(clientA.viewer))).not.toContain("stl_live_");
    expect(JSON.stringify(await clientsData.listClients(admin))).not.toContain("stl_live_");
    await expect(setSettledEnabled(other.admin, clientA.client.id, true)).rejects.toThrow();
    await expect(setSettledEnabled(clientA.viewer, clientA.client.id, true)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("off locks it again but keeps the business; on again reuses it", async () => {
    const { admin, clientA } = await makeAgency();
    await setSettledEnabled(admin, clientA.client.id, true);
    const calls = seen.length;
    expect(await setSettledEnabled(admin, clientA.client.id, false)).toEqual({ enabled: false, ready: false });
    expect(await settledTarget(clientA.viewer)).toBeNull();
    await setSettledEnabled(admin, clientA.client.id, true);
    expect(seen.length).toBe(calls);
    expect(await settledTarget(clientA.viewer)).not.toBeNull();
  });

  it("a failed sign-up leaves the add-on off and says why", async () => {
    const { admin, clientA } = await makeAgency();
    await db.update(users).set({ email: "taken@test.local" }).where(eq(users.id, clientA.viewer.userId));
    await expect(setSettledEnabled(admin, clientA.client.id, true)).rejects.toThrow("That email already has an account.");
    expect(await settledAccess(admin, clientA.client.id)).toEqual({ enabled: false, ready: false });
  });

  it("asking for it files one request, and not from a preview", async () => {
    const { clientA } = await makeAgency();
    const first = await askForSettled(clientA.viewer);
    const again = await askForSettled(clientA.viewer);
    expect(first.already).toBe(false);
    expect(again).toEqual({ requestId: first.requestId, already: true });
    const rows = await db.select().from(requests).where(eq(requests.clientId, clientA.client.id));
    expect(rows.map((r) => r.title)).toEqual([SETTLED_REQUEST_TITLE]);
    await expect(askForSettled({ ...clientA.viewer, previewBy: "admin" })).rejects.toBeInstanceOf(ForbiddenError);
  });
});
