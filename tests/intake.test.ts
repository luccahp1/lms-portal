import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db, pool } from "@/db";
import { startLinks, users } from "@/db/schema";
import * as intakeData from "@/lib/data/intake";
import * as clientsData from "@/lib/data/clients";
import { callTool } from "@/lib/mcp/protocol";
import { sha256, verifyPassword } from "@/lib/auth/crypto";
import { cleanAnswers, INTAKE_QUESTIONS } from "@/lib/intake";
import { fillQuery, findTemplate, renderTemplate, TEMPLATES } from "@/lib/templates";
import { GET as templateRoute } from "@/app/templates/[slug]/route";
import type { Viewer } from "@/lib/data/viewer";
import { makeAgency, resetDb } from "./helpers";

// A new client's start: the link, the design pick, the answers, the first login.

beforeEach(resetDb);
afterEach(() => vi.unstubAllEnvs());
afterAll(() => pool.end());

async function call(viewer: Viewer, name: string, args: Record<string, unknown> = {}) {
  const result = await callTool(viewer, name, args);
  const text = result.content[0]!.text;
  return { isError: result.isError ?? false, text, data: result.isError ? undefined : JSON.parse(text) };
}

describe("the ten designs", () => {
  it("are ten, each a full page with every slot filled", () => {
    expect(TEMPLATES).toHaveLength(10);
    expect(new Set(TEMPLATES.map((t) => t.slug)).size).toBe(10);
    for (const t of TEMPLATES) {
      const html = renderTemplate(t);
      expect(html.startsWith("<!doctype html>"), t.slug).toBe(true);
      expect(html, t.slug).not.toContain("{{");
      expect(html, t.slug).toContain(t.sample.business.replace("&", "&amp;"));
      expect(html, t.slug).toContain(`href="tel:${t.sample.phone.replace(/\D/g, "")}"`);
      expect(html, t.slug).toContain('name="robots" content="noindex"');
      // Self-contained: nothing loaded from anywhere but the font service.
      const outside = [...html.matchAll(/(?:src|href)="(https?:[^"]+)"/g)].map((m) => m[1]!).filter((u) => !/^https:\/\/fonts\.(googleapis|gstatic)\.com/.test(u));
      expect(outside, t.slug).toEqual([]);
    }
  });

  it("carry a business's own name, escaped", async () => {
    const html = renderTemplate(findTemplate("trades")!, { business: `Joe's <b>Plumbing</b> & Sons`, phone: "(519) 555-0100", city: "St. Thomas" });
    expect(html).toContain("Joe&#39;s &lt;b&gt;Plumbing&lt;/b&gt; &amp; Sons");
    expect(html).not.toContain("<b>Plumbing</b>");
    expect(html).toContain('href="tel:5195550100"');
    expect(html).toContain("St. Thomas");
    expect(fillQuery({ business: "A & B", phone: null })).toBe("?name=A+%26+B");

    const res = await templateRoute(new Request("http://portal.test/templates/salon?name=%3Cscript%3Ealert(1)%3C/script%3E"), { params: Promise.resolve({ slug: "salon" }) });
    const page = await res.text();
    expect(res.headers.get("x-robots-tag")).toContain("noindex");
    expect(page).not.toContain("<script>alert(1)</script>");
    expect((await templateRoute(new Request("http://portal.test/templates/nope"), { params: Promise.resolve({ slug: "nope" }) })).status).toBe(404);
  });
});

describe("start links", () => {
  it("are made by the agency, for its own clients, and only the newest unused one works", async () => {
    const { admin, clientA } = await makeAgency();
    const other = await makeAgency();
    await expect(intakeData.createStartLink(clientA.viewer, clientA.client.id)).rejects.toThrow("Forbidden");
    await expect(intakeData.createStartLink(other.admin, clientA.client.id)).rejects.toThrow();

    const first = await intakeData.createStartLink(admin, clientA.client.id, "Dana Reid");
    const second = await intakeData.createStartLink(admin, clientA.client.id, "Dana Reid");
    expect(await intakeData.loadStart(first.token)).toBeNull();
    const start = await intakeData.loadStart(second.token);
    expect(start).toMatchObject({ clientId: clientA.client.id, clientName: clientA.client.name, contactName: "Dana Reid", claimed: false });
    expect(await intakeData.loadStart("short")).toBeNull();
    expect(await intakeData.loadStart(second.token + "x")).toBeNull();
    // Only the hash is stored.
    const rows = await db.select().from(startLinks);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.tokenHash).toBe(sha256(second.token));
  });

  it("stop working after 30 days", async () => {
    const { admin, clientA } = await makeAgency();
    const { token } = await intakeData.createStartLink(admin, clientA.client.id);
    await db.update(startLinks).set({ expiresAt: new Date(Date.now() - 1000) });
    expect(await intakeData.loadStart(token)).toBeNull();
    await expect(intakeData.saveIntakeByToken(token, { templateSlug: "trades" })).rejects.toThrow("expired");
    await expect(intakeData.claimStart(token, { name: "A", email: "a@new.test", password: "long-enough-pw" })).rejects.toThrow("expired");
    expect((await intakeData.getStartLinkState(admin, clientA.client.id))!.state).toBe("expired");
  });

  it("save the pick and the answers without a login, for that one client", async () => {
    const { admin, clientA, clientB } = await makeAgency();
    const { token } = await intakeData.createStartLink(admin, clientA.client.id);
    await expect(intakeData.saveIntakeByToken(token, { templateSlug: "not-a-design" })).rejects.toThrow("No such design");
    await intakeData.saveIntakeByToken(token, { templateSlug: "roofing", templateNote: "  Like the dark look  " });
    await intakeData.saveIntakeByToken(token, { answers: { services: "Roofs\nEavestrough", phone: " 519 555 0100 ", bogus: "dropped", area: "   " } });
    let intake = await intakeData.getIntake(admin, clientA.client.id);
    expect(intake).toMatchObject({ templateSlug: "roofing", templateNote: "Like the dark look", answers: { services: "Roofs\nEavestrough", phone: "519 555 0100" }, submittedAt: null });
    await intakeData.saveIntakeByToken(token, { answers: intake.answers, submit: true });
    intake = await intakeData.getIntake(clientA.viewer);
    expect(intake.submittedAt).toBeInstanceOf(Date);
    expect(intake.templateSlug).toBe("roofing");
    // Nothing leaked to the other client.
    expect(await intakeData.getIntake(clientB.viewer)).toMatchObject({ templateSlug: null, answers: {} });
    await expect(intakeData.getIntake(clientB.viewer, clientA.client.id)).rejects.toThrow();
  });

  it("create the first login once, active straight away, and are spent after", async () => {
    const { admin, clientA } = await makeAgency();
    const { token } = await intakeData.createStartLink(admin, clientA.client.id, "Dana Reid");
    await expect(intakeData.claimStart(token, { name: "Dana", email: clientA.viewer.email, password: "long-enough-pw" })).rejects.toThrow("already uses");
    const userId = await intakeData.claimStart(token, { name: " Dana Reid ", email: "Dana@NewClient.test", password: "long-enough-pw" });
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    expect(user).toMatchObject({ clientId: clientA.client.id, role: "client", status: "active", email: "dana@newclient.test", name: "Dana Reid" });
    expect(await verifyPassword("long-enough-pw", user!.passwordHash!)).toBe(true);
    expect((await clientsData.listClientUsers(admin, clientA.client.id)).map((u) => u.email)).toContain("dana@newclient.test");

    expect((await intakeData.loadStart(token))!.claimed).toBe(true);
    await expect(intakeData.claimStart(token, { name: "Eve", email: "eve@x.test", password: "long-enough-pw" })).rejects.toThrow("already been used");
    await expect(intakeData.saveIntakeByToken(token, { templateSlug: "trades" })).rejects.toThrow("already been used");
    expect((await intakeData.getStartLinkState(admin, clientA.client.id))!.state).toBe("claimed");
    // A used link stays on record; a new one can still be made for a second person.
    await intakeData.createStartLink(admin, clientA.client.id);
    expect(await db.select().from(startLinks)).toHaveLength(2);
  });

  it("two people racing the same link make one login", async () => {
    const { admin, clientA } = await makeAgency();
    const { token } = await intakeData.createStartLink(admin, clientA.client.id);
    const results = await Promise.allSettled([
      intakeData.claimStart(token, { name: "One", email: "one@race.test", password: "long-enough-pw" }),
      intakeData.claimStart(token, { name: "Two", email: "two@race.test", password: "long-enough-pw" }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const made = await db.select({ email: users.email }).from(users).where(eq(users.clientId, clientA.client.id));
    expect(made.filter((u) => u.email.endsWith("@race.test"))).toHaveLength(1);
  });
});

describe("intake after they have a login", () => {
  it("the client edits their own, the agency can record one, a preview can't", async () => {
    const { admin, clientA, clientB } = await makeAgency();
    await intakeData.saveIntake(clientA.viewer, { templateSlug: "salon" });
    await intakeData.saveIntake(admin, { templateSlug: "clinic", templateNote: "Picked in the meeting" }, clientB.client.id);
    expect((await intakeData.getIntake(clientA.viewer)).templateSlug).toBe("salon");
    expect(await intakeData.getIntake(clientB.viewer)).toMatchObject({ templateSlug: "clinic", templateNote: "Picked in the meeting" });
    await expect(intakeData.saveIntake(clientA.viewer, { templateSlug: "auto" }, clientB.client.id)).rejects.toThrow();
    await expect(intakeData.saveIntake({ ...clientA.viewer, previewBy: "Admin" }, { templateSlug: "auto" })).rejects.toThrow("Forbidden");
  });

  it("keeps only known questions, trimmed and capped", () => {
    expect(cleanAnswers({ services: "  a  ", nope: "x", phone: 5, area: "", proof: "p".repeat(5000) })).toEqual({ services: "a", proof: "p".repeat(2000) });
    expect(new Set(INTAKE_QUESTIONS.map((q) => q.key)).size).toBe(INTAKE_QUESTIONS.length);
  });
});

describe("onboarding over MCP", () => {
  it("makes a start link, reads the intake, and moves the stage", async () => {
    vi.stubEnv("APP_URL", "https://portal.test");
    const { admin, clientA } = await makeAgency();
    const listed = await call(admin, "list_site_templates");
    expect(listed.data.templates).toHaveLength(10);
    expect(listed.data.templates[0].url).toBe("https://portal.test/templates/trades");

    const link = await call(admin, "create_start_link", { clientId: clientA.client.id, contactName: "Dana" });
    expect(link.data.url).toMatch(/^https:\/\/portal\.test\/start\/[A-Za-z0-9_-]{40,}$/);
    const token = link.data.url.split("/start/")[1];
    await intakeData.saveIntakeByToken(token, { templateSlug: "rentals", answers: { services: "Trailers" }, submit: true });

    const intake = await call(admin, "get_intake", { clientId: clientA.client.id });
    expect(intake.data.template).toMatchObject({ slug: "rentals", name: "Yard" });
    expect(intake.data.questions.find((q: { key: string }) => q.key === "services").answer).toBe("Trailers");
    expect(intake.data.startLink.state).toBe("open");
    // The token itself never comes back out.
    expect(JSON.stringify(intake.data)).not.toContain(token);

    expect((await call(admin, "save_intake", { clientId: clientA.client.id, templateSlug: "trades" })).data.templateSlug).toBe("trades");
    expect((await call(admin, "set_client_stage", { clientId: clientA.client.id, stage: "build" })).isError).toBe(false);
    expect((await call(admin, "set_client_stage", { clientId: clientA.client.id, stage: "nonsense" })).isError).toBe(true);
    const portal = await call(admin, "get_client_portal", { clientId: clientA.client.id });
    expect(portal.data.client.stage).toBe("build");
    expect(portal.data.intake).toMatchObject({ templateSlug: "trades", templateName: "Workhorse" });
    expect(portal.data.startLink.state).toBe("open");
    expect((await call(admin, "new_client_guide")).data.steps.join(" ")).toContain("create_start_link");
    await expect(clientsData.setStage(clientA.viewer, clientA.client.id, "launched")).rejects.toThrow("Forbidden");
  });
});
