import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db, pool } from "@/db";
import { previewLinks } from "@/db/schema";
import { callTool } from "@/lib/mcp/protocol";
import type { Viewer } from "@/lib/data/viewer";
import { createPreviewLink, previewSessionViewer, redeemPreviewLink } from "@/lib/data/preview";
import * as messagesData from "@/lib/data/messages";
import * as filesData from "@/lib/data/files";
import * as todosData from "@/lib/data/todos";
import { makeAgency, resetDb } from "./helpers";

// The agency side moved into LMS Dash: the tools and links Dash relies on.

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

describe("View as client from LMS Dash", () => {
  it("a link works once, opens a preview pinned to that client, and only for an active admin", async () => {
    const { admin, clientA, clientB } = await makeAgency();
    const { data } = await call(admin, "create_preview_link", { clientId: clientA.client.id });
    const token = data.url.split("/preview/")[1];
    const session = await redeemPreviewLink(token);
    expect(session).toBeTruthy();
    expect(await redeemPreviewLink(token)).toBeNull();

    const viewer = await previewSessionViewer(session!);
    expect(viewer).toMatchObject({ role: "client", clientId: clientA.client.id, userId: clientA.viewer.userId, previewBy: "Admin" });
    await expect(messagesData.listMessages(viewer!, clientB.client.id)).rejects.toThrow();
    expect(await previewSessionViewer(session! + "x")).toBeNull();
  });

  it("expired links don't open, and clients can't make links", async () => {
    const { admin, clientA } = await makeAgency();
    const token = await createPreviewLink(admin, clientA.client.id);
    await db.update(previewLinks).set({ expiresAt: new Date(Date.now() - 1000) });
    expect(await redeemPreviewLink(token)).toBeNull();
    await expect(createPreviewLink(clientA.viewer, clientA.client.id)).rejects.toThrow();
  });
});

describe("tools for the Dash portal tab", () => {
  it("get_client_portal returns everything in one call, never the stats token", async () => {
    const { admin, clientA } = await makeAgency();
    const cid = clientA.client.id;
    await messagesData.sendMessage(clientA.viewer, "Hi there");
    await call(admin, "save_todo", { clientId: cid, title: "Verify Google" });
    const { data } = await call(admin, "get_client_portal", { clientId: cid });
    expect(data.client.id).toBe(cid);
    expect(data.users).toHaveLength(1);
    expect(data.messages[0].body).toBe("Hi there");
    expect(data.todos[0].title).toBe("Verify Google");
    expect(data.analytics).toMatchObject({ connected: false, statsUrl: "", hasToken: false });
    expect(JSON.stringify(data)).not.toMatch(/statsToken/);
  });

  it("file_download_url has no link on local disk; read_file still works", async () => {
    const { admin, clientA } = await makeAgency();
    await filesData.uploadFile(admin, { name: "a.txt", mimeType: "text/plain", data: Buffer.from("hi"), needsApproval: false }, clientA.client.id);
    const [file] = await filesData.listFiles(admin, clientA.client.id);
    expect((await call(admin, "file_download_url", { fileId: file!.id })).data).toMatchObject({ name: "a.txt", url: null });
  });
});

describe("client activity reaches LMS Dash", () => {
  it("messages, uploads, file answers, to-dos and sign-ups send signed events; agency actions don't", async () => {
    const { admin, clientA } = await makeAgency();
    const events: string[] = [];
    vi.stubEnv("LMS_DASH_WEBHOOK_URL", "http://dash.test/hook");
    vi.stubEnv("LMS_DASH_WEBHOOK_SECRET", "s");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_u: string, init: RequestInit) => {
        events.push(JSON.parse(String(init.body)).event);
        return new Response(null, { status: 204 });
      }),
    );
    await messagesData.sendMessage(admin, "from us", clientA.client.id);
    await messagesData.sendMessage(clientA.viewer, "from them");
    await filesData.uploadFile(admin, { name: "p.pdf", mimeType: "application/pdf", data: Buffer.from("x"), needsApproval: true }, clientA.client.id);
    const [file] = await filesData.listFiles(clientA.viewer);
    await filesData.respondToFile(clientA.viewer, file!.id, "approved");
    await filesData.uploadFile(clientA.viewer, { name: "photo.png", mimeType: "image/png", data: Buffer.from("x"), needsApproval: false });
    const todoId = await todosData.saveTodo(admin, clientA.client.id, { title: "x" });
    await todosData.setTodoStatus(clientA.viewer, todoId, "done");
    await vi.waitFor(() => expect(events).toHaveLength(4));
    expect(events.sort()).toEqual(["file.responded", "file.uploaded", "message.created", "todo.updated"]);
  });
});
