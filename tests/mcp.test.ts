import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, pool } from "@/db";
import { users } from "@/db/schema";
import { createApiToken, NotAdminError, revokeApiTokens, viewerFromApiToken } from "@/lib/auth/apiTokens";
import { callTool, handleMcpMessage } from "@/lib/mcp/protocol";
import { POST } from "@/app/api/mcp/route";
import type { Viewer } from "@/lib/data/viewer";
import { makeAgency, resetDb } from "./helpers";

beforeEach(resetDb);
afterAll(() => pool.end());

async function call(viewer: Viewer, name: string, args: Record<string, unknown> = {}) {
  const result = await callTool(viewer, name, args);
  const text = result.content[0]!.text;
  return { isError: result.isError ?? false, text, data: result.isError ? undefined : JSON.parse(text) };
}

function rpc(method: string, params?: Record<string, unknown>) {
  return { jsonrpc: "2.0", id: 1, method, ...(params && { params }) };
}

describe("API tokens", () => {
  it("resolve to the admin who owns them, and stop working once revoked", async () => {
    const { admin } = await makeAgency();
    const token = await createApiToken(admin.userId, "Claude Code");
    expect(token.startsWith("lmsp_")).toBe(true);
    expect((await viewerFromApiToken(token))?.userId).toBe(admin.userId);
    expect(await viewerFromApiToken(token + "x")).toBeNull();
    expect(await viewerFromApiToken("not-a-token")).toBeNull();

    expect(await revokeApiTokens(admin.userId, "Claude Code")).toBe(1);
    expect(await viewerFromApiToken(token)).toBeNull();
  });

  it("can't be made for clients, and an admin's token dies if they lose admin", async () => {
    const { admin, clientA } = await makeAgency();
    await expect(createApiToken(clientA.viewer.userId, "x")).rejects.toBeInstanceOf(NotAdminError);
    const token = await createApiToken(admin.userId, "x");
    await db.update(users).set({ role: "client" }).where(eq(users.id, admin.userId));
    expect(await viewerFromApiToken(token)).toBeNull();
  });
});

describe("MCP protocol", () => {
  it("handshakes and lists every tool with a JSON schema", async () => {
    const { admin } = await makeAgency();
    const init = await handleMcpMessage(admin, rpc("initialize", { protocolVersion: "2025-06-18" }));
    expect(init.body).toMatchObject({ result: { protocolVersion: "2025-06-18", serverInfo: { name: "lms-portal" } } });

    const list = (await handleMcpMessage(admin, rpc("tools/list"))).body as { result: { tools: { name: string; inputSchema: { type: string } }[] } };
    const names = list.result.tools.map((t) => t.name);
    expect(names).toContain("get_overview");
    expect(names).toContain("send_message");
    for (const t of list.result.tools) expect(t.inputSchema.type).toBe("object");
  });

  it("answers notifications with 202 and unknown methods with an error", async () => {
    const { admin } = await makeAgency();
    const notification = { jsonrpc: "2.0", method: "notifications/initialized" };
    expect(await handleMcpMessage(admin, notification)).toEqual({ status: 202 });
    expect((await handleMcpMessage(admin, rpc("nope"))).body).toMatchObject({ error: { code: -32601 } });
  });
});

describe("MCP tools", () => {
  it("does admin work end to end through the data layer", async () => {
    const { admin, clientA } = await makeAgency();
    const overview = await call(admin, "get_overview");
    expect(overview.data.clients).toHaveLength(2);
    expect(overview.data.agency.signUpLink).toMatch(/\/join\//);

    const created = await call(admin, "create_client", { name: "New Co", websiteUrl: "https://new.co" });
    expect(created.data.name).toBe("New Co");

    const cid = clientA.client.id;
    await call(admin, "send_message", { clientId: cid, body: "Hello from the agency" });
    expect((await call(admin, "list_messages", { clientId: cid })).data[0].body).toBe("Hello from the agency");

    const { data: req } = await call(admin, "create_request", { clientId: cid, title: "Fix header" });
    await call(admin, "comment_on_request", { requestId: req.requestId, body: "On it" });
    await call(admin, "set_request_status", { requestId: req.requestId, status: "review" });
    const detail = await call(admin, "get_request", { requestId: req.requestId });
    expect(detail.data.request.status).toBe("review");
    expect(detail.data.comments[0].body).toBe("On it");

    await call(admin, "upsert_monthly_note", { clientId: cid, month: "2026-10", wins: "Ranked #1" });
    await call(admin, "add_work_log", { clientId: cid, title: "New homepage", tag: "Website", doneOn: "2026-10-30" });
    expect((await call(admin, "get_client", { clientId: cid })).data.latestNote.wins).toBe("Ranked #1");

    await call(admin, "create_invoice", { clientId: cid, number: "INV-1", amount: 120.5, issuedOn: "2026-10-01", dueOn: "2026-10-31" });
    const invoices = await call(admin, "list_invoices", { clientId: cid });
    expect(invoices.data[0]).toMatchObject({ number: "INV-1", amountCents: 12050, status: "draft" });

    await call(admin, "upload_file", { clientId: cid, name: "notes.txt", mimeType: "text/plain", text: "hi there" });
    const [file] = (await call(admin, "list_files", { clientId: cid })).data;
    expect((await call(admin, "read_file", { fileId: file.id })).data).toMatchObject({ encoding: "utf-8", content: "hi there" });
    await call(admin, "delete_file", { fileId: file.id });
    expect((await call(admin, "list_files", { clientId: cid })).data).toHaveLength(0);
  });

  it("rejects bad input with a readable error instead of throwing", async () => {
    const { admin, clientA } = await makeAgency();
    const bad = await call(admin, "add_work_log", { clientId: clientA.client.id, title: "x", tag: "y", doneOn: "yesterday" });
    expect(bad.isError).toBe(true);
    expect(bad.text).toMatch(/doneOn/);
    expect((await call(admin, "no_such_tool")).isError).toBe(true);
    expect((await call(admin, "approve_signup", { userId: clientA.viewer.userId })).text).toMatch(/clientId or newClientName/);
  });

  it("can't reach another agency's clients", async () => {
    const one = await makeAgency();
    const other = await makeAgency();
    const leak = await call(one.admin, "list_messages", { clientId: other.clientA.client.id });
    expect(leak.isError).toBe(true);
    expect(leak.text).toBe("Not found");
    expect((await call(one.admin, "get_overview")).data.clients).toHaveLength(2);
  });

  it("only flags data-changing tools for revalidation", async () => {
    const { admin, clientA } = await makeAgency();
    let changes = 0;
    await callTool(admin, "list_clients", {}, () => changes++);
    expect(changes).toBe(0);
    await callTool(admin, "send_message", { clientId: clientA.client.id, body: "hi" }, () => changes++);
    expect(changes).toBe(1);
  });
});

describe("/api/mcp route", () => {
  const post = (body: unknown, token?: string) =>
    POST(
      new Request("http://localhost/api/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token && { Authorization: `Bearer ${token}` }) },
        body: JSON.stringify(body),
      }),
    );

  it("needs a valid token", async () => {
    await makeAgency();
    expect((await post(rpc("ping"))).status).toBe(401);
    expect((await post(rpc("ping"), "lmsp_wrong")).status).toBe(401);
  });

  it("serves tool calls for a valid token", async () => {
    const { admin } = await makeAgency();
    const token = await createApiToken(admin.userId, "test");
    const res = await post(rpc("tools/call", { name: "list_clients", arguments: {} }), token);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(JSON.parse(body.result.content[0].text)).toHaveLength(2);
  });
});
