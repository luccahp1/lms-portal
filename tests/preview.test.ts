import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db, pool } from "@/db";
import { clients, invoices } from "@/db/schema";
import { NOBODY_ID, previewViewer } from "@/lib/data/preview";
import { ForbiddenError, NotFoundError } from "@/lib/data/viewer";
import { listInvoices } from "@/lib/data/invoices";
import { makeAgency, resetDb } from "./helpers";

beforeEach(resetDb);
afterAll(() => pool.end());

describe("View as client", () => {
  it("shows an admin the portal exactly as the client's user sees it", async () => {
    const { admin, clientA } = await makeAgency();
    const preview = await previewViewer(admin, clientA.client.id);
    expect(preview).toMatchObject({
      ...clientA.viewer,
      role: "client",
      status: "active",
      clientId: clientA.client.id,
      previewBy: admin.name,
    });

    // Same filtering as the real client: drafts stay hidden.
    const base = { agencyId: admin.agencyId, clientId: clientA.client.id, amountCents: 100, issuedOn: "2026-10-01", dueOn: "2026-10-15" };
    await db.insert(invoices).values([
      { ...base, number: "D-1", status: "draft" },
      { ...base, number: "S-1", status: "sent" },
    ]);
    expect((await listInvoices(preview)).map((i) => i.number)).toEqual(["S-1"]);
  });

  it("falls back to a placeholder when nobody has joined the client yet", async () => {
    const { admin } = await makeAgency();
    const [empty] = await db.insert(clients).values({ agencyId: admin.agencyId, name: "Empty Co" }).returning();
    const preview = await previewViewer(admin, empty.id);
    expect(preview.userId).toBe(NOBODY_ID);
    expect(preview.clientId).toBe(empty.id);
  });

  it("ignores a user id that isn't one of this client's people", async () => {
    const { admin, clientA, clientB } = await makeAgency();
    const preview = await previewViewer(admin, clientA.client.id, clientB.viewer.userId);
    expect(preview.userId).toBe(clientA.viewer.userId);
  });

  it("is admin only and stays inside the admin's agency", async () => {
    const { admin, clientA } = await makeAgency();
    const other = await makeAgency();
    await expect(previewViewer(clientA.viewer, clientA.client.id)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(previewViewer(admin, other.clientA.client.id)).rejects.toBeInstanceOf(NotFoundError);
  });
});
