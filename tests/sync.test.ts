import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Client } from "pg";
import { eq } from "drizzle-orm";
import { db, pool } from "@/db";
import { siteStats } from "@/db/schema";
import { callTool } from "@/lib/mcp/protocol";
import { NotFoundError, ForbiddenError, type Viewer } from "@/lib/data/viewer";
import * as rankingsData from "@/lib/data/rankings";
import * as todosData from "@/lib/data/todos";
import * as statsData from "@/lib/data/stats";
import * as requestsData from "@/lib/data/requests";
import * as filesData from "@/lib/data/files";
import * as clientsData from "@/lib/data/clients";
import { refreshClientStats } from "@/lib/stats/refresh";
import { sign } from "@/lib/webhook";
import { makeAgency, resetDb } from "./helpers";

beforeEach(resetDb);
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
afterAll(() => pool.end());

async function call(viewer: Viewer, name: string, args: Record<string, unknown> = {}) {
  const result = await callTool(viewer, name, args);
  const text = result.content[0]!.text;
  return { isError: result.isError ?? false, text, data: result.isError ? undefined : JSON.parse(text) };
}

describe("rankings and AI answers pushed from LMS Dash", () => {
  it("sync replaces the set, and each client only sees its own", async () => {
    const { admin, clientA, clientB } = await makeAgency();
    const cid = clientA.client.id;
    const first = await call(admin, "sync_rankings", {
      clientId: cid,
      keywords: [
        { keyword: "storage trailer rental london", priority: "High", positions: { "2026-10": 2 } },
        { keyword: "dry van rental", positions: { "2026-10": 29, "2026-11": 21 } },
      ],
    });
    expect(first.data.keywords).toBe(2);
    await call(admin, "sync_rankings", { clientId: cid, keywords: [{ keyword: "dry van rental", positions: { "2026-11": 18 } }] });
    const list = await rankingsData.listRankings(clientA.viewer);
    expect(list).toEqual([{ keyword: "dry van rental", priority: "", history: [{ month: "2026-11", position: 18 }] }]);
    expect(await rankingsData.listRankings(clientB.viewer)).toEqual([]);
    await expect(rankingsData.syncRankings(clientA.viewer, cid, [])).rejects.toBeInstanceOf(ForbiddenError);

    await call(admin, "sync_ai_answers", {
      clientId: cid,
      questions: [{ question: "Who rents storage trailers in London?", results: { "2026-10": { ChatGPT: "no", "Google AI": "yes" } } }],
    });
    const ai = await rankingsData.listAiAnswers(clientA.viewer);
    expect(ai[0]!.answers).toHaveLength(2);
    expect((await call(admin, "sync_ai_answers", { clientId: cid, questions: [{ question: "q", results: { "2026-10": { X: "maybe" } } }] })).isError).toBe(true);
  });

  it("upsert_invoice keys on the number and keeps drafts hidden", async () => {
    const { admin, clientA, clientB } = await makeAgency();
    const base = { clientId: clientA.client.id, number: "LMS-0002", amountCents: 125000, issuedOn: "2026-10-27", dueOn: "2026-10-27" };
    expect((await call(admin, "upsert_invoice", { ...base, status: "draft" })).data.created).toBe(true);
    const { listInvoices } = await import("@/lib/data/invoices");
    expect(await listInvoices(clientA.viewer)).toHaveLength(0);
    expect((await call(admin, "upsert_invoice", { ...base, status: "sent" })).data.created).toBe(false);
    expect((await listInvoices(clientA.viewer))[0]).toMatchObject({ number: "LMS-0002", status: "sent" });
    const clash = await call(admin, "upsert_invoice", { ...base, clientId: clientB.client.id, status: "sent" });
    expect(clash.isError).toBe(true);
  });

  it("delete_invoice removes one client's copy, so the number can move to another client", async () => {
    const { admin, clientA, clientB } = await makeAgency();
    const { listInvoices, deleteInvoiceByNumber } = await import("@/lib/data/invoices");
    const base = { number: "LMS-0007", amountCents: 50000, issuedOn: "2026-11-01", dueOn: "2026-11-15", status: "sent" };
    await call(admin, "upsert_invoice", { ...base, clientId: clientA.client.id });
    await call(admin, "upsert_invoice", { ...base, number: "LMS-0008", clientId: clientA.client.id });

    // The wrong client's id removes nothing.
    expect((await call(admin, "delete_invoice", { clientId: clientB.client.id, number: "LMS-0007" })).data.deleted).toBe(false);
    expect(await listInvoices(clientA.viewer)).toHaveLength(2);
    await expect(deleteInvoiceByNumber(clientA.viewer, clientA.client.id, "LMS-0007")).rejects.toBeInstanceOf(ForbiddenError);

    expect((await call(admin, "delete_invoice", { clientId: clientA.client.id, number: "LMS-0007" })).data.deleted).toBe(true);
    expect((await listInvoices(clientA.viewer)).map((i) => i.number)).toEqual(["LMS-0008"]);
    expect((await call(admin, "upsert_invoice", { ...base, clientId: clientB.client.id })).data.created).toBe(true);
    expect((await listInvoices(clientB.viewer)).map((i) => i.number)).toEqual(["LMS-0007"]);
  });
});

describe("payments pushed from LMS Dash", () => {
  it("part payments lower the balance, show a notice once, and a removed payment comes back off", async () => {
    const { admin, clientA, clientB } = await makeAgency();
    const { listInvoices, balance } = await import("@/lib/data/invoices");
    const { listPayments, markPaymentsSeen } = await import("@/lib/data/payments");
    const cid = clientA.client.id;
    const inv = { clientId: cid, issuedOn: "2026-11-01", status: "sent" };
    await call(admin, "upsert_invoice", { ...inv, number: "LMS-0002", description: "Website build", amountCents: 85000, dueOn: "2026-11-01" });
    await call(admin, "upsert_invoice", { ...inv, number: "LMS-0003", description: "Monthly, November", amountCents: 35000, dueOn: "2026-11-16" });

    // $1,000 of $1,200: Dash covers the oldest invoice, then part of the next.
    await call(admin, "upsert_invoice", { ...inv, number: "LMS-0002", description: "Website build", amountCents: 85000, dueOn: "2026-11-01", status: "paid", paidCents: 85000 });
    await call(admin, "upsert_invoice", { ...inv, number: "LMS-0003", description: "Monthly, November", amountCents: 35000, dueOn: "2026-11-16", paidCents: 15000 });
    const synced = await call(admin, "sync_payments", {
      clientId: cid,
      monthlyCents: 36500,
      payments: [{ ref: "7", amountCents: 100000, paidOn: "2026-11-12", note: "e-Transfer" }],
    });
    expect(synced.data.payments).toBe(1);

    const client = await clientsData.getClient(clientA.viewer);
    expect(client.monthlyCents).toBe(36500);
    const b = balance(await listInvoices(clientA.viewer), "2026-11-12", client.creditCents);
    expect(b.owing).toBe(20000);
    expect(b.paid).toBe(100000);
    expect(b.open).toEqual([{ number: "LMS-0003", description: "Monthly, November", dueOn: "2026-11-16", leftCents: 20000, partPaid: true }]);

    // The notice shows until dismissed, and a re-sync of the same payment keeps it dismissed.
    expect((await listPayments(clientA.viewer)).filter((p) => !p.seenAt)).toHaveLength(1);
    await markPaymentsSeen(clientA.viewer);
    await call(admin, "sync_payments", { clientId: cid, monthlyCents: 36500, payments: [{ ref: "7", amountCents: 100000, paidOn: "2026-11-12" }] });
    expect((await listPayments(clientA.viewer)).filter((p) => !p.seenAt)).toHaveLength(0);
    expect(await listPayments(clientB.viewer)).toEqual([]);

    // Overpaid: the rest is credit. Removed in Dash: gone here too.
    await call(admin, "sync_payments", { clientId: cid, monthlyCents: null, creditCents: 5000, payments: [] });
    expect(await listPayments(clientA.viewer)).toEqual([]);
    expect((await clientsData.getClient(clientA.viewer)).creditCents).toBe(5000);
    expect((await call(admin, "sync_payments", { clientId: cid, monthlyCents: null, payments: [{ ref: "x", amountCents: -5, paidOn: "2026-11-12" }] })).isError).toBe(true);
  });

  it("a client cannot sync payments, and an admin preview never clears the notice", async () => {
    const { admin, clientA } = await makeAgency();
    const { syncPayments, listPayments, markPaymentsSeen } = await import("@/lib/data/payments");
    await expect(syncPayments(clientA.viewer, clientA.client.id, { monthlyCents: null, creditCents: 0 }, [])).rejects.toBeInstanceOf(ForbiddenError);
    await call(admin, "sync_payments", { clientId: clientA.client.id, monthlyCents: null, payments: [{ ref: "1", amountCents: 500, paidOn: "2026-11-12" }] });
    await markPaymentsSeen({ ...clientA.viewer, previewBy: admin.userId });
    expect((await listPayments(clientA.viewer))[0]!.seenAt).toBeNull();
  });
});

describe("to-dos", () => {
  it("admin writes them, the client ticks them off, nobody else can touch them", async () => {
    const { admin, clientA, clientB } = await makeAgency();
    const { data } = await call(admin, "save_todo", {
      clientId: clientA.client.id,
      title: "Verify your Google Business Profile",
      steps: "Open the link\nRecord the video",
      linkUrl: "https://business.google.com",
      linkLabel: "Open Google",
    });
    expect(await todosData.countOpenTodos(clientA.viewer)).toBe(1);
    await expect(todosData.setTodoStatus(clientB.viewer, data.todoId, "done")).rejects.toBeInstanceOf(NotFoundError);
    await expect(todosData.saveTodo(clientA.viewer, clientA.client.id, { title: "x" })).rejects.toBeInstanceOf(ForbiddenError);
    await todosData.setTodoStatus(clientA.viewer, data.todoId, "done");
    const [todo] = await todosData.listTodos(clientA.viewer);
    expect(todo).toMatchObject({ status: "done", doneById: clientA.viewer.userId });
    expect(await todosData.countOpenTodos(clientA.viewer)).toBe(0);
    expect((await call(admin, "save_todo", { clientId: clientA.client.id, title: "x", linkUrl: "javascript:alert(1)" })).isError).toBe(true);
  });
});

describe("site stats", () => {
  it("fetches with the token, stores the rows, hides the token and the error detail from clients", async () => {
    const { admin, clientA } = await makeAgency();
    const fetchMock = vi.fn(async () =>
      Response.json({ ok: true, since: "2026-10-23", rows: [{ day: "2026-10-24", kind: "visit", page: "/", source: "", detail: "", n: 3 }] }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await statsData.setStatsSource(admin, clientA.client.id, { statsUrl: "https://site.test/api/stats", statsToken: "secret" });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit];
    expect(String(url)).toMatch(/^https:\/\/site\.test\/api\/stats\?from=\d{4}-\d{2}-01&to=/);
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer secret");

    const stats = await statsData.getSiteStats(clientA.viewer);
    expect(stats).toMatchObject({ connected: true, since: "2026-10-23", error: null });
    expect(stats.rows[0]!.n).toBe(3);
    const client = await clientsData.getClient(clientA.viewer);
    expect(client).not.toHaveProperty("statsToken");

    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 401 })));
    await refreshClientStats(clientA.client.id);
    expect((await statsData.getSiteStats(clientA.viewer)).error).toBe("unavailable");
    expect((await statsData.getSiteStats(admin, clientA.client.id)).error).toMatch(/401/);
    // The last good numbers stay.
    expect((await statsData.getSiteStats(clientA.viewer)).rows).toHaveLength(1);
    await expect(statsData.setStatsSource(admin, clientA.client.id, { statsUrl: "http://plain.test" })).rejects.toThrow(/https/);
  });

  it("only rewrites the rows when they change", async () => {
    const { admin, clientA } = await makeAgency();
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ ok: true, since: null, rows: [] })));
    await statsData.setStatsSource(admin, clientA.client.id, { statsUrl: "https://site.test/api/stats", statsToken: "t" });
    await db.update(siteStats).set({ rows: [{ day: "x", kind: "visit", page: "", source: "", detail: "", n: 1 }] }).where(eq(siteStats.clientId, clientA.client.id));
    await refreshClientStats(clientA.client.id);
    const [row] = await db.select().from(siteStats).where(eq(siteStats.clientId, clientA.client.id));
    expect(row!.rows).toEqual([]);
  });
});

describe("tickets for LMS Dash", () => {
  it("lists activity since a time with comments, and signs webhook calls", async () => {
    const { admin, clientA } = await makeAgency();
    const sent: { body: string; sig: string | null }[] = [];
    vi.stubEnv("LMS_DASH_WEBHOOK_URL", "http://dash.test/api/portal/webhook");
    vi.stubEnv("LMS_DASH_WEBHOOK_SECRET", "s3cret");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        sent.push({ body: String(init.body), sig: new Headers(init.headers).get("X-LMS-Signature") });
        return new Response(null, { status: 204 });
      }),
    );
    const before = new Date(Date.now() - 1000);
    const id = await requestsData.createRequest(clientA.viewer, { title: "New photos", details: "Swap the hero" });
    await requestsData.addRequestComment(admin, id, "On it");
    await vi.waitFor(() => expect(sent).toHaveLength(2));
    const body = JSON.parse(sent[0]!.body);
    expect(body).toMatchObject({ event: "request.created", requestId: id, clientName: clientA.client.name, status: "received" });
    expect(sent[0]!.sig).toBe(sign(sent[0]!.body, "s3cret"));

    const activity = await call(admin, "list_request_activity", { since: before.toISOString() });
    expect(activity.data).toHaveLength(1);
    expect(activity.data[0]).toMatchObject({ title: "New photos", clientName: clientA.client.name });
    expect(activity.data[0].comments[0]).toMatchObject({ body: "On it", authorRole: "agency_admin" });
    expect((await call(admin, "list_request_activity", { since: new Date(Date.now() + 60_000).toISOString() })).data).toHaveLength(0);

    await call(admin, "delete_request", { requestId: id });
    expect(await requestsData.listRequests(clientA.viewer)).toHaveLength(0);
    await expect(requestsData.deleteRequest(clientA.viewer, id)).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("logins and brand files", () => {
  it("create_client_user makes an active login with a set-password link", async () => {
    const { admin, clientA } = await makeAgency();
    const res = await call(admin, "create_client_user", { clientId: clientA.client.id, email: "Office@Example.CA", name: "Office" });
    expect(res.data.setPasswordUrl).toMatch(/\/reset\/[A-Za-z0-9_-]+$/);
    const people = await clientsData.listClientUsers(admin, clientA.client.id);
    expect(people.map((p) => p.email)).toContain("office@example.ca");
    expect((await call(admin, "create_client_user", { clientId: clientA.client.id, email: "office@example.ca", name: "x" })).isError).toBe(true);
  });

  it("brand files sit in their own folder; clients can't file into it", async () => {
    const { admin, clientA } = await makeAgency();
    const png = Buffer.from("89504e47", "hex");
    await call(admin, "upload_file", { clientId: clientA.client.id, name: "business-card-front.png", mimeType: "image/png", contentBase64: png.toString("base64"), folder: "brand" });
    await filesData.uploadFile(clientA.viewer, { name: "mine.png", mimeType: "image/png", data: png, needsApproval: false, folder: "brand" });
    expect((await filesData.listFiles(clientA.viewer, undefined, "brand")).map((f) => f.name)).toEqual(["business-card-front.png"]);
    expect((await filesData.listFiles(clientA.viewer, undefined, "")).map((f) => f.name)).toEqual(["mine.png"]);
    expect(filesData.isInlineImage("image/png")).toBe(true);
    expect(filesData.isInlineImage("image/svg+xml")).toBe(false);
  });
});

describe("live updates", () => {
  it("a change to client data sends NOTIFY with agency and client", async () => {
    const { admin, clientA } = await makeAgency();
    const listener = new Client({ connectionString: process.env.DATABASE_URL });
    await listener.connect();
    const got: string[] = [];
    listener.on("notification", (m) => m.payload && got.push(m.payload));
    await listener.query("LISTEN portal_changes");
    const id = await requestsData.createRequest(clientA.viewer, { title: "x", details: "" });
    await requestsData.addRequestComment(admin, id, "hello");
    await call(admin, "sync_rankings", { clientId: clientA.client.id, keywords: [{ keyword: "k", positions: { "2026-10": 3 } }] });
    await vi.waitFor(() => expect(got.length).toBeGreaterThanOrEqual(3));
    const expected = `${admin.agencyId}:${clientA.client.id}`;
    expect(got.every((p) => p === expected)).toBe(true);
    await listener.end();
  });
});
