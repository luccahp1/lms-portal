import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { pool } from "@/db";
import { NotFoundError, ForbiddenError } from "@/lib/data/viewer";
import * as requestsData from "@/lib/data/requests";
import * as messagesData from "@/lib/data/messages";
import * as filesData from "@/lib/data/files";
import * as invoicesData from "@/lib/data/invoices";
import * as updatesData from "@/lib/data/updates";
import * as clientsData from "@/lib/data/clients";
import { makeAgency, resetDb } from "./helpers";

beforeEach(resetDb);
afterAll(() => pool.end());

describe("client isolation within an agency", () => {
  it("a client only ever sees their own requests", async () => {
    const { clientA, clientB } = await makeAgency();
    await requestsData.createRequest(clientA.viewer, { title: "A's request", details: "" });
    const bId = await requestsData.createRequest(clientB.viewer, { title: "B's request", details: "" });

    const visible = await requestsData.listRequests(clientA.viewer);
    expect(visible.map((r) => r.title)).toEqual(["A's request"]);
    await expect(requestsData.getRequest(clientA.viewer, bId)).rejects.toBeInstanceOf(NotFoundError);
    await expect(requestsData.addRequestComment(clientA.viewer, bId, "hi")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("a client cannot target another client by passing its id", async () => {
    const { clientA, clientB } = await makeAgency();
    await expect(requestsData.listRequests(clientA.viewer, clientB.client.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(messagesData.sendMessage(clientA.viewer, "sneaky", clientB.client.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      requestsData.createRequest(clientA.viewer, { title: "x", details: "" }, clientB.client.id),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(await messagesData.listMessages(clientB.viewer)).toHaveLength(0);
  });

  it("a client cannot download another client's file", async () => {
    const { admin, clientA, clientB } = await makeAgency();
    await filesData.uploadFile(admin, { name: "b.pdf", mimeType: "application/pdf", data: Buffer.from("b"), needsApproval: false }, clientB.client.id);
    const [bFile] = await filesData.listFiles(clientB.viewer);
    await expect(filesData.getFile(clientA.viewer, bFile!.id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("clients cannot use admin-only operations", async () => {
    const { clientA } = await makeAgency();
    await expect(clientsData.listClients(clientA.viewer)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      updatesData.addWorkLog(clientA.viewer, clientA.client.id, { title: "x", tag: "x", doneOn: "2026-10-01" }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    const id = await requestsData.createRequest(clientA.viewer, { title: "x", details: "" });
    await expect(requestsData.setRequestStatus(clientA.viewer, id, "done")).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("agency isolation", () => {
  it("an admin cannot reach another agency's clients or rows", async () => {
    const one = await makeAgency();
    const two = await makeAgency();
    const reqId = await requestsData.createRequest(two.clientA.viewer, { title: "Agency two", details: "" });
    await updatesData.addWorkLog(two.admin, two.clientA.client.id, { title: "w", tag: "t", doneOn: "2026-10-01" });
    const [entry] = await updatesData.listWorkLog(two.admin, two.clientA.client.id);
    await invoicesData.createInvoice(two.admin, two.clientA.client.id, {
      number: "INV-1",
      description: "",
      amountCents: 100,
      issuedOn: "2026-10-01",
      dueOn: "2026-10-15",
      status: "sent",
    });
    const [invoice] = await invoicesData.listInvoices(two.admin, two.clientA.client.id);

    expect((await clientsData.listClients(one.admin)).map((c) => c.id)).not.toContain(two.clientA.client.id);
    await expect(clientsData.getClient(one.admin, two.clientA.client.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(requestsData.getRequest(one.admin, reqId)).rejects.toBeInstanceOf(NotFoundError);
    await expect(requestsData.setRequestStatus(one.admin, reqId, "done")).rejects.toBeInstanceOf(NotFoundError);
    await expect(updatesData.deleteWorkLog(one.admin, entry!.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(invoicesData.setInvoiceStatus(one.admin, invoice!.id, "paid")).rejects.toBeInstanceOf(NotFoundError);
    expect(await requestsData.listAgencyOpenRequests(one.admin)).toHaveLength(0);
  });
});

describe("storage limit", () => {
  afterAll(() => {
    delete process.env.STORAGE_LIMIT_BYTES;
  });

  it("refuses an upload that would take total storage past the limit", async () => {
    const { admin, clientA, clientB } = await makeAgency();
    process.env.STORAGE_LIMIT_BYTES = "5";
    await filesData.uploadFile(admin, { name: "a.txt", mimeType: "text/plain", data: Buffer.from("abc"), needsApproval: false }, clientA.client.id);
    // The limit covers the whole bucket, not one client.
    await expect(
      filesData.uploadFile(clientB.viewer, { name: "b.txt", mimeType: "text/plain", data: Buffer.from("def"), needsApproval: false }),
    ).rejects.toBeInstanceOf(filesData.StorageFullError);
    expect(await filesData.listFiles(clientB.viewer)).toHaveLength(0);
    await filesData.uploadFile(clientB.viewer, { name: "c.txt", mimeType: "text/plain", data: Buffer.from("gh"), needsApproval: false });
  });
});

describe("workflow rules", () => {
  it("clients approve only requests that are ready for review", async () => {
    const { admin, clientA } = await makeAgency();
    const id = await requestsData.createRequest(clientA.viewer, { title: "Banner", details: "" });
    await expect(requestsData.approveRequest(clientA.viewer, id)).rejects.toBeInstanceOf(NotFoundError);
    await requestsData.setRequestStatus(admin, id, "review");
    await requestsData.approveRequest(clientA.viewer, id);
    expect((await requestsData.getRequest(clientA.viewer, id)).request.status).toBe("done");
  });

  it("clients never see draft invoices", async () => {
    const { admin, clientA } = await makeAgency();
    const base = { description: "", amountCents: 5000, issuedOn: "2026-10-01", dueOn: "2026-10-15" };
    await invoicesData.createInvoice(admin, clientA.client.id, { ...base, number: "D-1", status: "draft" });
    await invoicesData.createInvoice(admin, clientA.client.id, { ...base, number: "S-1", status: "sent" });
    expect((await invoicesData.listInvoices(clientA.viewer)).map((i) => i.number)).toEqual(["S-1"]);
    expect(await invoicesData.listInvoices(admin, clientA.client.id)).toHaveLength(2);
  });

  it("only agency uploads can ask for approval, and only clients answer", async () => {
    const { admin, clientA } = await makeAgency();
    await filesData.uploadFile(clientA.viewer, { name: "mine.jpg", mimeType: "image/jpeg", data: Buffer.from("x"), needsApproval: true });
    await filesData.uploadFile(admin, { name: "design.png", mimeType: "image/png", data: Buffer.from("y"), needsApproval: true }, clientA.client.id);
    const files = await filesData.listFiles(clientA.viewer);
    const mine = files.find((f) => f.name === "mine.jpg")!;
    const design = files.find((f) => f.name === "design.png")!;
    expect(mine.approval).toBe("none");
    expect(design.approval).toBe("pending");

    await expect(filesData.respondToFile(admin, design.id, "approved")).rejects.toBeInstanceOf(NotFoundError);
    await filesData.respondToFile(clientA.viewer, design.id, "approved");
    await expect(filesData.respondToFile(clientA.viewer, design.id, "changes_requested")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("monthly notes upsert per month", async () => {
    const { admin, clientA } = await makeAgency();
    const note = { month: "2026-10", wins: "a", workingOn: "b", nextMonth: "c" };
    await updatesData.upsertNote(admin, clientA.client.id, note);
    await updatesData.upsertNote(admin, clientA.client.id, { ...note, wins: "updated" });
    const notes = await updatesData.listNotes(clientA.viewer);
    expect(notes).toHaveLength(1);
    expect(notes[0]!.wins).toBe("updated");
  });
});
