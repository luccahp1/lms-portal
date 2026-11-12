import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { pool } from "@/db";
import { ForbiddenError, NotFoundError } from "@/lib/data/viewer";
import * as clientsData from "@/lib/data/clients";
import { makeAgency, resetDb } from "./helpers";

beforeEach(resetDb);
afterAll(() => pool.end());

describe("a client's job dashboard link", () => {
  it("is set by an admin and shown only to that client", async () => {
    const { admin, clientA, clientB } = await makeAgency();
    expect(await clientsData.setClientDashboard(admin, clientA.client.id, " https://acme.example.com/ ")).toBe("https://acme.example.com");

    expect((await clientsData.getClient(clientA.viewer)).dashboardUrl).toBe("https://acme.example.com");
    expect((await clientsData.getClient(clientB.viewer)).dashboardUrl).toBeNull();

    expect(await clientsData.setClientDashboard(admin, clientA.client.id, "")).toBeNull();
    expect((await clientsData.getClient(clientA.viewer)).dashboardUrl).toBeNull();
  });

  it("refuses anything that is not a plain https address", async () => {
    const { admin, clientA } = await makeAgency();
    for (const bad of ["javascript:alert(1)", "http://acme.example.com", "https://user:pw@acme.example.com", "acme"]) {
      await expect(clientsData.setClientDashboard(admin, clientA.client.id, bad)).rejects.toThrow();
    }
    expect((await clientsData.getClient(clientA.viewer)).dashboardUrl).toBeNull();
  });

  it("cannot be set by a client, or for another agency's client", async () => {
    const { clientA } = await makeAgency();
    const other = await makeAgency();
    await expect(clientsData.setClientDashboard(clientA.viewer, clientA.client.id, "https://x.example.com")).rejects.toBeInstanceOf(ForbiddenError);
    await expect(clientsData.setClientDashboard(other.admin, clientA.client.id, "https://x.example.com")).rejects.toBeInstanceOf(NotFoundError);
  });
});
