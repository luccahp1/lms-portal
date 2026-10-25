import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, pool } from "@/db";
import { sessions, users } from "@/db/schema";
import { hashPassword, verifyPassword } from "@/lib/auth/crypto";
import { acceptInvite, findValidInvite } from "@/lib/data/invites";
import * as clientsData from "@/lib/data/clients";
import * as signupsData from "@/lib/data/signups";
import * as requestsData from "@/lib/data/requests";
import { ForbiddenError, NotFoundError } from "@/lib/data/viewer";
import { makeAgency, resetDb, toViewer } from "./helpers";

beforeEach(resetDb);
afterAll(() => pool.end());

async function loadUser(id: string) {
  const [u] = await db.select().from(users).where(eq(users.id, id));
  return u!;
}

const signup = (joinCode: string, email = "new@person.test") => ({
  joinCode,
  name: "New Person",
  email,
  password: "a-long-password",
  business: "New Person Plumbing",
});

describe("passwords", () => {
  it("verifies the right password and rejects the wrong one", async () => {
    const hash = await hashPassword("correct horse battery");
    expect(await verifyPassword("correct horse battery", hash)).toBe(true);
    expect(await verifyPassword("wrong", hash)).toBe(false);
    expect(await verifyPassword("anything", "garbage")).toBe(false);
  });
});

describe("self sign-up", () => {
  it("creates a pending account in the agency that owns the join code", async () => {
    const { agency } = await makeAgency();
    const id = await signupsData.signUp({ ...signup(agency.joinCode), email: "New@Person.TEST" });
    const user = await loadUser(id);
    expect(user).toMatchObject({ agencyId: agency.id, role: "client", status: "pending", clientId: null, email: "new@person.test" });
    expect(await verifyPassword("a-long-password", user.passwordHash!)).toBe(true);
  });

  it("rejects unknown join codes and taken emails", async () => {
    const { agency, clientA } = await makeAgency();
    await expect(signupsData.signUp(signup("not-a-code"))).rejects.toBeInstanceOf(NotFoundError);
    await expect(signupsData.signUp(signup(agency.joinCode, clientA.viewer.email))).rejects.toBeInstanceOf(signupsData.EmailTakenError);
  });

  it("a pending account can't touch any data", async () => {
    const { agency, clientA } = await makeAgency();
    const pending = toViewer(await loadUser(await signupsData.signUp(signup(agency.joinCode))));
    await expect(requestsData.listRequests(pending)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(requestsData.listRequests(pending, clientA.client.id)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(clientsData.getClient(pending)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("approving links the account to an existing client", async () => {
    const { agency, admin, clientA } = await makeAgency();
    const id = await signupsData.signUp(signup(agency.joinCode));
    expect(await signupsData.listPendingSignups(admin)).toHaveLength(1);

    await signupsData.approveSignup(admin, id, { clientId: clientA.client.id });
    const viewer = toViewer(await loadUser(id));
    expect(viewer).toMatchObject({ status: "active", clientId: clientA.client.id });
    await requestsData.listRequests(viewer);
    expect(await signupsData.listPendingSignups(admin)).toHaveLength(0);
    expect((await clientsData.listClientUsers(admin, clientA.client.id)).map((u) => u.id)).toContain(id);
  });

  it("approving can create a new client from the business name", async () => {
    const { agency, admin } = await makeAgency();
    const id = await signupsData.signUp(signup(agency.joinCode));
    const clientId = await signupsData.approveSignup(admin, id, { newClientName: "New Person Plumbing" });
    expect((await clientsData.getClient(admin, clientId)).name).toBe("New Person Plumbing");
    expect((await loadUser(id)).clientId).toBe(clientId);
  });

  it("admins only see and decide their own agency's sign-ups", async () => {
    const one = await makeAgency();
    const two = await makeAgency();
    const id = await signupsData.signUp(signup(two.agency.joinCode));
    expect(await signupsData.listPendingSignups(one.admin)).toHaveLength(0);
    await expect(signupsData.approveSignup(one.admin, id, { newClientName: "x" })).rejects.toBeInstanceOf(NotFoundError);
    await expect(signupsData.approveSignup(two.admin, id, { clientId: one.clientA.client.id })).rejects.toBeInstanceOf(NotFoundError);
    await expect(signupsData.rejectSignup(one.admin, id)).rejects.toBeInstanceOf(NotFoundError);
    await signupsData.rejectSignup(two.admin, id);
    expect(await db.select().from(users).where(eq(users.id, id))).toHaveLength(0);
  });
});

describe("password reset links", () => {
  it("work once, set the password and log out existing sessions", async () => {
    const { admin, clientA } = await makeAgency();
    await db.insert(sessions).values({ id: "s1", userId: clientA.viewer.userId, expiresAt: new Date(Date.now() + 60_000) });
    const token = await clientsData.createPasswordResetLink(admin, clientA.viewer.userId);
    expect(await findValidInvite(token)).not.toBeNull();

    expect(await acceptInvite(token, "a-new-long-password")).toBe(clientA.viewer.userId);
    expect(await verifyPassword("a-new-long-password", (await loadUser(clientA.viewer.userId)).passwordHash!)).toBe(true);
    expect(await db.select().from(sessions).where(eq(sessions.userId, clientA.viewer.userId))).toHaveLength(0);
    expect(await acceptInvite(token, "another-password")).toBeNull();
  });

  it("admins can't make links or remove access for another agency's users", async () => {
    const one = await makeAgency();
    const two = await makeAgency();
    await expect(clientsData.createPasswordResetLink(one.admin, two.clientA.viewer.userId)).rejects.toBeInstanceOf(NotFoundError);
    await expect(clientsData.removeClientUser(one.admin, two.clientA.viewer.userId)).rejects.toBeInstanceOf(NotFoundError);
    await expect(clientsData.createPasswordResetLink(one.admin, one.admin.userId)).rejects.toBeInstanceOf(NotFoundError);
  });
});

