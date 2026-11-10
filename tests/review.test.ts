import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { eq } from "drizzle-orm";
import { db, pool } from "@/db";
import { changeNotes, clients } from "@/db/schema";
import * as reviewData from "@/lib/data/review";
import * as requestsData from "@/lib/data/requests";
import * as filesData from "@/lib/data/files";
import * as clientsData from "@/lib/data/clients";
import { saveIntake } from "@/lib/data/intake";
import { previewViewer } from "@/lib/data/preview";
import { callTool } from "@/lib/mcp/protocol";
import { describeNotes } from "@/lib/review/describe";
import { isPrivateAddress, mapUrl, rewriteCss, rewriteHtml, sameSite, agentTag } from "@/lib/review/proxy";
import { mintReviewToken, verifyReviewToken } from "@/lib/review/token";
import { GET } from "@/app/site/[token]/[[...path]]/route";
import type { Viewer } from "@/lib/data/viewer";
import { makeAgency, resetDb } from "./helpers";

// "Request website changes": the notes, the request they become, and the frame that serves
// the client's own site through the portal.

beforeEach(resetDb);
afterEach(() => vi.unstubAllEnvs());
afterAll(() => pool.end());

const anchor = { selector: "#hero > h1:nth-of-type(1)", tag: "h1", text: "Trailers for rent", rx: 0.2, ry: 0.5, docX: 120, docY: 300, w: 600, h: 80 };
const pin = (body = "Make this bigger") => ({ kind: "pin" as const, pagePath: "/", pageTitle: "Home", anchor, viewportW: 1280, body });

async function call(viewer: Viewer, name: string, args: Record<string, unknown> = {}) {
  const result = await callTool(viewer, name, args);
  const text = result.content[0]!.text;
  return { isError: result.isError ?? false, text, data: result.isError ? undefined : JSON.parse(text) };
}

describe("change notes", () => {
  it("collect in the client's own draft, and nobody else's", async () => {
    const { admin, clientA, clientB } = await makeAgency();
    await reviewData.addNote(clientA.viewer, "site", pin());
    await reviewData.addNote(clientA.viewer, "site", {
      kind: "text",
      pagePath: "/about?x=1#team",
      anchor,
      viewportW: 390,
      textBefore: "Call us today",
      textAfter: "Call or text us today",
    });
    await reviewData.addNote(clientA.viewer, "template", { kind: "page", pagePath: "/", body: "Our colours are green and white" });

    const draft = await reviewData.listDraft(clientA.viewer, "site");
    expect(draft.map((n) => n.kind)).toEqual(["pin", "text"]);
    expect(draft[1]).toMatchObject({ pagePath: "/about", textBefore: "Call us today", textAfter: "Call or text us today", viewportW: 390 });
    expect(await reviewData.listDraft(clientA.viewer, "template")).toHaveLength(1);
    expect(await reviewData.listDraft(clientB.viewer, "site")).toHaveLength(0);
    // The agency reads a client's draft by naming the client; a client can't name another.
    expect(await reviewData.listDraft(admin, "site", clientA.client.id)).toHaveLength(2);
    await expect(reviewData.listDraft(clientB.viewer, "site", clientA.client.id)).rejects.toThrow();
  });

  it("can only be written by the client: not the agency, not a View as client preview", async () => {
    const { admin, clientA } = await makeAgency();
    await expect(reviewData.addNote(admin, "site", pin())).rejects.toThrow("Forbidden");
    const preview = await previewViewer(admin, clientA.client.id);
    await expect(reviewData.addNote(preview, "site", pin())).rejects.toThrow("Forbidden");
    await expect(reviewData.submitDraft(preview, "site")).rejects.toThrow("Forbidden");
  });

  it("need something to say, and a spot to say it about", async () => {
    const { clientA, clientB } = await makeAgency();
    await expect(reviewData.addNote(clientA.viewer, "site", pin(""))).rejects.toThrow("Say what should change");
    await expect(reviewData.addNote(clientA.viewer, "site", { kind: "pin", pagePath: "/", body: "x" })).rejects.toThrow();
    await expect(
      reviewData.addNote(clientA.viewer, "site", { kind: "text", pagePath: "/", anchor, textBefore: "Same", textAfter: "Same" }),
    ).rejects.toThrow("didn't change");
    await expect(reviewData.addNote(clientA.viewer, "site", { kind: "draw", pagePath: "/", anchor, body: "x", strokes: [] })).rejects.toThrow("empty");
    // A file can stand in for words, but only one of this client's files.
    const mine = await filesData.uploadFile(clientA.viewer, { name: "truck.jpg", mimeType: "image/jpeg", data: Buffer.from("x"), needsApproval: false });
    const theirs = await filesData.uploadFile(clientB.viewer, { name: "b.jpg", mimeType: "image/jpeg", data: Buffer.from("x"), needsApproval: false });
    await reviewData.addNote(clientA.viewer, "site", { ...pin(""), fileId: mine });
    await expect(reviewData.addNote(clientA.viewer, "site", { ...pin(""), fileId: theirs })).rejects.toThrow();
    const [note] = await reviewData.listDraft(clientA.viewer, "site");
    expect(note).toMatchObject({ fileId: mine, fileName: "truck.jpg" });
  });

  it("can be edited and deleted while they are a draft, by their own client only", async () => {
    const { clientA, clientB } = await makeAgency();
    const id = await reviewData.addNote(clientA.viewer, "site", pin());
    await expect(reviewData.updateNote(clientB.viewer, id, "hijack")).rejects.toThrow();
    await expect(reviewData.deleteNote(clientB.viewer, id)).rejects.toThrow();
    await reviewData.updateNote(clientA.viewer, id, "  Make this much bigger  ");
    expect((await reviewData.listDraft(clientA.viewer, "site"))[0]!.body).toBe("Make this much bigger");
    await reviewData.deleteNote(clientA.viewer, id);
    expect(await reviewData.listDraft(clientA.viewer, "site")).toHaveLength(0);
  });

  it("keep drawings small and numbers sane", async () => {
    const { clientA } = await makeAgency();
    const long = Array.from({ length: 5000 }, (_, i) => i / 5000);
    await reviewData.addNote(clientA.viewer, "site", {
      kind: "draw",
      pagePath: "/",
      anchor: { ...anchor, rx: 99, docX: -5, selector: "x".repeat(900) },
      body: "Move this",
      strokes: [long, [0.1, 0.1, 0.2, Number.NaN], [1]],
    });
    const [note] = await reviewData.listDraft(clientA.viewer, "site");
    expect(note!.strokes).toHaveLength(2);
    expect(note!.strokes![0]!.length).toBe(1200);
    expect(note!.strokes![1]).toEqual([0.1, 0.1, 0.2, 0]);
    expect(note!.anchor).toMatchObject({ rx: 5, docX: 0 });
    expect(note!.anchor!.selector.length).toBe(600);
  });
});

describe("sending the draft", () => {
  it("makes one request with the notes filed under it, described in words", async () => {
    const { admin, clientA } = await makeAgency();
    await reviewData.addNote(clientA.viewer, "site", pin());
    await reviewData.addNote(clientA.viewer, "site", { kind: "text", pagePath: "/contact", pageTitle: "Contact", anchor, viewportW: 390, textBefore: "519 555 0100", textAfter: "519 555 0199" });
    await reviewData.addNote(clientA.viewer, "template", { kind: "page", pagePath: "/", body: "Different draft" });

    const requestId = await reviewData.submitDraft(clientA.viewer, "site", { neededBy: "2026-12-01" });
    const { request, changeNotes: notes } = await requestsData.getRequest(admin, requestId);
    expect(request.title).toBe("Website changes: 2 notes");
    expect(request.details).toContain("2 changes marked on the website. Needed by 2026-12-01.");
    expect(request.details).toContain("1. Comment on Home (/)");
    expect(request.details).toContain("2. Wording on Contact (/contact), phone layout");
    expect(request.details).toContain("Change “519 555 0100” to “519 555 0199”");
    expect(notes.map((n) => n.kind)).toEqual(["pin", "text"]);

    // The site draft is empty again; the design draft is untouched.
    expect(await reviewData.listDraft(clientA.viewer, "site")).toHaveLength(0);
    expect(await reviewData.listDraft(clientA.viewer, "template")).toHaveLength(1);
    await expect(reviewData.submitDraft(clientA.viewer, "site")).rejects.toThrow("nothing to send");
    // Sent notes are part of the request now.
    await expect(reviewData.updateNote(clientA.viewer, notes[0]!.id, "changed my mind")).rejects.toThrow();
    await expect(reviewData.deleteNote(clientA.viewer, notes[0]!.id)).rejects.toThrow();
  });

  it("the agency ticks notes off, the client sees the count, and other agencies can't touch them", async () => {
    const { admin, clientA, clientB } = await makeAgency();
    const other = await makeAgency();
    await reviewData.addNote(clientA.viewer, "site", pin("one"));
    await reviewData.addNote(clientA.viewer, "site", pin("two"));
    const requestId = await reviewData.submitDraft(clientA.viewer, "site", { title: "Spring changes" });
    const { changeNotes: notes } = await requestsData.getRequest(clientA.viewer, requestId);

    await expect(reviewData.setNoteDone(clientA.viewer, notes[0]!.id, true)).rejects.toThrow("Forbidden");
    await expect(reviewData.setNoteDone(other.admin, notes[0]!.id, true)).rejects.toThrow();
    await reviewData.setNoteDone(admin, notes[0]!.id, true);

    const [row] = await requestsData.listRequests(clientA.viewer);
    expect(row).toMatchObject({ title: "Spring changes", notes: { done: 1, total: 2 } });
    await expect(requestsData.getRequest(clientB.viewer, requestId)).rejects.toThrow();
    const activity = await requestsData.listRequestActivity(admin);
    expect(activity[0]!.changeNotes).toHaveLength(2);

    await reviewData.setNoteDone(admin, notes[0]!.id, false);
    expect((await requestsData.listRequests(clientA.viewer))[0]!.notes).toEqual({ done: 0, total: 2 });
    // Deleting the request takes its notes with it.
    await requestsData.deleteRequest(admin, requestId);
    expect(await db.select().from(changeNotes).where(eq(changeNotes.clientId, clientA.client.id))).toHaveLength(0);
  });

  it("works over MCP: notes come back with the request and can be ticked", async () => {
    const { admin, clientA } = await makeAgency();
    await reviewData.addNote(clientA.viewer, "site", pin());
    const requestId = await reviewData.submitDraft(clientA.viewer, "site");
    const got = await call(admin, "get_request", { requestId });
    expect(got.data.changeNotes).toHaveLength(1);
    const done = await call(admin, "set_change_note_done", { noteId: got.data.changeNotes[0].id, done: true });
    expect(done.data).toMatchObject({ done: true, requestId });
    expect((await call(admin, "get_request", { requestId })).data.changeNotes[0].doneAt).toBeTruthy();
  });

  it("describes a page note and an attachment", () => {
    const text = describeNotes(
      [
        { kind: "page", pagePath: "/", pageTitle: "", viewportW: 0, body: "Add financing", textBefore: null, textAfter: null, anchor: null },
        { kind: "pin", pagePath: "/", pageTitle: "", viewportW: 1280, body: "", textBefore: null, textAfter: null, anchor: { text: "", tag: "img" }, fileName: "truck.jpg" },
      ],
      { source: "template" },
    );
    expect(text).toBe("2 changes marked on the design.\n\n1. Page note on /\n   Add financing\n\n2. Comment on /\n   At a picture\n   Attached: truck.jpg");
  });
});

describe("the review source", () => {
  it("is set by the agency, must be a web address, and falls back to the live site", async () => {
    const { admin, clientA } = await makeAgency();
    await db.update(clients).set({ websiteUrl: "https://live.example" }).where(eq(clients.id, clientA.client.id));
    expect((await reviewData.reviewTarget(clientA.client.id))!.siteUrl).toBe("https://live.example");
    await expect(clientsData.setReviewSource(clientA.viewer, clientA.client.id, "https://x.example")).rejects.toThrow("Forbidden");
    for (const bad of ["ftp://x.example", "not a url", "javascript:alert(1)", "https://user:pw@x.example"]) {
      await expect(clientsData.setReviewSource(admin, clientA.client.id, bad)).rejects.toThrow("full web address");
    }
    expect((await call(admin, "set_review_source", { clientId: clientA.client.id, url: "https://preview.pages.dev/" })).data.reviewUrl).toBe("https://preview.pages.dev/");
    expect((await reviewData.reviewTarget(clientA.client.id))!.siteUrl).toBe("https://preview.pages.dev/");
    await clientsData.setReviewSource(admin, clientA.client.id, "");
    expect((await reviewData.reviewTarget(clientA.client.id))!.siteUrl).toBe("https://live.example");
    // The client sees it on their own record, never another client's.
    expect((await clientsData.getClient(clientA.viewer)).reviewUrl).toBeNull();
  });
});

describe("frame tokens", () => {
  const clientId = "69943bce-49ad-4e43-97d0-9d24bc997d20";
  it("name one client and one source, and expire", () => {
    const now = Date.UTC(2026, 10, 10);
    const token = mintReviewToken({ clientId, source: "site" }, now);
    expect(verifyReviewToken(token, now)).toEqual({ clientId, source: "site" });
    expect(verifyReviewToken(mintReviewToken({ clientId, source: "template" }, now), now)).toEqual({ clientId, source: "template" });
    expect(verifyReviewToken(token, now + 13 * 3600_000)).toBeNull();
  });
  it("can't be forged or altered", () => {
    const token = mintReviewToken({ clientId, source: "site" });
    const [id, kind, exp, mac] = token.split(".");
    expect(verifyReviewToken(`11111111-2222-4333-8444-555555555555.${kind}.${exp}.${mac}`)).toBeNull();
    expect(verifyReviewToken(`${id}.t.${exp}.${mac}`)).toBeNull();
    expect(verifyReviewToken(`${id}.${kind}.${Number(exp) + 9999}.${mac}`)).toBeNull();
    expect(verifyReviewToken(`${id}.${kind}.${exp}.${"A".repeat(32)}`)).toBeNull();
    expect(verifyReviewToken("")).toBeNull();
    expect(verifyReviewToken("a.b.c")).toBeNull();
  });
});

describe("rewriting a client's site for the frame", () => {
  const rw = { prefix: "/site/TOKEN", host: "maplerental.ca" };
  it("points same-site addresses at the frame and leaves the rest", () => {
    expect(mapUrl("/assets/main.css", rw)).toBe("/site/TOKEN/assets/main.css");
    expect(mapUrl("https://maplerental.ca/trailers?x=1#top", rw)).toBe("/site/TOKEN/trailers?x=1#top");
    expect(mapUrl("https://www.maplerental.ca", rw)).toBe("/site/TOKEN/");
    expect(mapUrl("//maplerental.ca/a.png", rw)).toBe("/site/TOKEN/a.png");
    expect(mapUrl("/site/TOKEN/already", rw)).toBe("/site/TOKEN/already");
    for (const same of ["img/a.png", "../a.css", "#quote", "mailto:a@b.ca", "tel:5195550100", "data:image/png;base64,AA", "https://fonts.googleapis.com/css2", "//cdn.example/x.js", "https://evilmaplerental.ca/x"]) {
      expect(mapUrl(same, rw)).toBe(same);
    }
    expect(sameSite("WWW.MapleRental.ca", "maplerental.ca")).toBe(true);
    expect(sameSite("maplerental.ca.evil.com", "maplerental.ca")).toBe(false);
  });

  it("rewrites a page, injects the script first, and drops what would block it", () => {
    const html = `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'self'">
<link rel="stylesheet" href="/assets/main.css" integrity="sha384-abc"><style>.hero{background:url('/img/hero.jpg')}</style></head>
<body><a href="https://maplerental.ca/trailers">Trailers</a><a href="https://facebook.com/maple">FB</a>
<img src="/img/a.jpg" srcset="/img/a.jpg 1x, /img/a@2x.jpg 2x"><form action="/api/quote" method="post"></form><script src='/assets/js/main.js'></script></body></html>`;
    const out = rewriteHtml(html, rw, agentTag(rw));
    expect(out).toContain(`<head><script src="/review-agent.js?v=`);
    expect(out).toContain(`data-prefix="/site/TOKEN" data-host="maplerental.ca"`);
    expect(out).not.toMatch(/Content-Security-Policy/i);
    expect(out).not.toContain("integrity");
    expect(out).toContain(`href="/site/TOKEN/assets/main.css"`);
    expect(out).toContain(`url('/site/TOKEN/img/hero.jpg')`);
    expect(out).toContain(`href="/site/TOKEN/trailers"`);
    expect(out).toContain(`href="https://facebook.com/maple"`);
    expect(out).toContain(`srcset="/site/TOKEN/img/a.jpg 1x, /site/TOKEN/img/a@2x.jpg 2x"`);
    expect(out).toContain(`action="/site/TOKEN/api/quote"`);
    expect(out).toContain(`src='/site/TOKEN/assets/js/main.js'`);
    // A page with no <head> still gets the script, after the doctype.
    expect(rewriteHtml("<!DOCTYPE html><p>Hi</p>", rw, "<script></script>")).toBe("<!DOCTYPE html><script></script><p>Hi</p>");
  });

  it("rewrites stylesheets", () => {
    expect(rewriteCss(`@import "/base.css";@font-face{src:url(/fonts/a.woff2) format("woff2")}.x{background:url("img/rel.png")}`, rw)).toBe(
      `@import "/site/TOKEN/base.css";@font-face{src:url(/site/TOKEN/fonts/a.woff2) format("woff2")}.x{background:url("img/rel.png")}`,
    );
  });

  it("knows a private address when it sees one", () => {
    for (const a of ["127.0.0.1", "10.1.2.3", "192.168.1.10", "172.16.0.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1", "nonsense"]) {
      expect(isPrivateAddress(a), a).toBe(true);
    }
    for (const a of ["8.8.8.8", "172.32.0.1", "104.21.3.4", "2606:4700::1111"]) expect(isPrivateAddress(a), a).toBe(false);
  });
});

describe("the frame route", () => {
  let server: Server;
  let base: string;
  const hits: string[] = [];

  beforeEach(async () => {
    hits.length = 0;
    server = createServer((req, res) => {
      hits.push(`${req.method} ${req.url}`);
      if (req.url === "/") {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Set-Cookie": "sid=1", "X-Frame-Options": "DENY" });
        res.end(`<html><head><title>Fixture</title><link rel="stylesheet" href="/main.css"></head><body><a href="/about">About</a></body></html>`);
      } else if (req.url === "/main.css") {
        res.writeHead(200, { "Content-Type": "text/css" });
        res.end("body{background:url(/bg.png)}");
      } else if (req.url === "/old") {
        res.writeHead(301, { Location: "/" });
        res.end();
      } else if (req.url === "/away") {
        res.writeHead(302, { Location: "https://elsewhere.example/x" });
        res.end();
      } else {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("nope");
      }
    });
    await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterEach(() => new Promise<void>((done) => server.close(() => done())));

  async function get(token: string, path = "/") {
    const parts = path.split("/").filter(Boolean);
    return GET(new Request(`http://portal.test/site/${token}${path}`), { params: Promise.resolve({ token, path: parts }) });
  }

  it("serves the client's site sandboxed, with the script injected and addresses rewritten", async () => {
    vi.stubEnv("REVIEW_ALLOW_PRIVATE", "true");
    const { admin, clientA } = await makeAgency();
    await clientsData.setReviewSource(admin, clientA.client.id, base);
    const token = mintReviewToken({ clientId: clientA.client.id, source: "site" });

    const page = await get(token);
    expect(page.status).toBe(200);
    expect(page.headers.get("content-security-policy")).toMatch(/^sandbox allow-scripts/);
    expect(page.headers.get("content-security-policy")).not.toContain("allow-same-origin");
    expect(page.headers.get("set-cookie")).toBeNull();
    expect(page.headers.get("x-frame-options")).toBeNull();
    const html = await page.text();
    expect(html).toContain(`<script src="/review-agent.js`);
    expect(html).toContain(`href="/site/${token}/main.css"`);
    expect(html).toContain(`href="/site/${token}/about"`);

    const css = await get(token, "/main.css");
    expect(await css.text()).toBe(`body{background:url(/site/${token}/bg.png)}`);
    expect(css.headers.get("content-security-policy")).toMatch(/^sandbox/);

    expect(css.headers.get("access-control-allow-origin")).toBe("*");

    // A redirect inside the site sends the browser to the same place inside the frame;
    // one that leaves the site is handed to the browser as it is.
    const moved = await get(token, "/old");
    expect(moved.status).toBe(302);
    expect(moved.headers.get("location")).toBe(`/site/${token}/`);
    const away = await get(token, "/away");
    expect(away.status).toBe(302);
    expect(away.headers.get("location")).toBe("https://elsewhere.example/x");
    expect((await get(token, "/missing")).status).toBe(404);
    expect(hits.every((h) => h.startsWith("GET "))).toBe(true);
  });

  it("refuses a bad token, a private address, and a client with no site", async () => {
    const { admin, clientA, clientB } = await makeAgency();
    expect((await get("nonsense")).status).toBe(401);
    await clientsData.setReviewSource(admin, clientA.client.id, base);
    // Without REVIEW_ALLOW_PRIVATE a site on our own network is never fetched.
    const blocked = await get(mintReviewToken({ clientId: clientA.client.id, source: "site" }));
    expect(blocked.status).toBe(403);
    expect(hits).toHaveLength(0);
    expect((await get(mintReviewToken({ clientId: clientB.client.id, source: "site" }))).status).toBe(404);
  });

  it("serves the picked design with the client's own name on it", async () => {
    const { clientA } = await makeAgency();
    const token = mintReviewToken({ clientId: clientA.client.id, source: "template" });
    expect((await get(token)).status).toBe(404);
    await saveIntake(clientA.viewer, { templateSlug: "rentals", answers: { phone: "519 555 0199" } });
    const res = await get(mintReviewToken({ clientId: clientA.client.id, source: "template" }));
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain(clientA.client.name);
    expect(html).toContain("519 555 0199");
    expect(html).toContain(`<script src="/review-agent.js`);
    expect(html).not.toContain("{{");
  });
});
