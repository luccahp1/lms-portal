import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, pool } from "@/db";
import { sessions, users } from "@/db/schema";
import { hashPassword, verifyPassword } from "@/lib/auth/crypto";
import { acceptInvite, createInvite, findValidInvite } from "@/lib/data/invites";
import * as clientsData from "@/lib/data/clients";
import { deleteStoredFile, readStoredFile } from "@/lib/storage";
import { makeAgency, resetDb } from "./helpers";

beforeEach(resetDb);
afterAll(() => pool.end());

describe("passwords", () => {
  it("verifies the right password and rejects the wrong one", async () => {
    const hash = await hashPassword("correct horse battery");
    expect(await verifyPassword("correct horse battery", hash)).toBe(true);
    expect(await verifyPassword("wrong", hash)).toBe(false);
    expect(await verifyPassword("anything", "garbage")).toBe(false);
  });
});

describe("invites", () => {
  it("creating a client returns a one-time invite that sets the password", async () => {
    const { admin } = await makeAgency();
    const { user, inviteToken } = await clientsData.createClient(admin, {
      name: "New Co",
      contactName: "Pat",
      contactEmail: "Pat@Example.com",
    });
    expect(user.email).toBe("pat@example.com");
    expect(user.passwordHash).toBeNull();
    expect(await findValidInvite(inviteToken)).not.toBeNull();

    expect(await acceptInvite(inviteToken, "a-long-password")).toBe(user.id);
    const [saved] = await db.select().from(users).where(eq(users.id, user.id));
    expect(await verifyPassword("a-long-password", saved!.passwordHash!)).toBe(true);

    expect(await acceptInvite(inviteToken, "another-password")).toBeNull();
    expect(await findValidInvite(inviteToken)).toBeNull();
  });

  it("a reset link logs out existing sessions", async () => {
    const { clientA } = await makeAgency();
    await db.insert(sessions).values({ id: "s1", userId: clientA.viewer.userId, expiresAt: new Date(Date.now() + 60_000) });
    const token = await createInvite(clientA.viewer.userId);
    await acceptInvite(token, "a-long-password");
    expect(await db.select().from(sessions).where(eq(sessions.userId, clientA.viewer.userId))).toHaveLength(0);
  });

  it("admins cannot re-invite users of another agency", async () => {
    const one = await makeAgency();
    const two = await makeAgency();
    await expect(clientsData.reinviteClientUser(one.admin, two.clientA.viewer.userId)).rejects.toThrow();
  });
});

describe("storage", () => {
  it("rejects keys that escape the storage folder", async () => {
    await expect(readStoredFile("../../etc/passwd")).rejects.toThrow("Invalid storage key");
    await expect(deleteStoredFile("../outside")).rejects.toThrow("Invalid storage key");
  });
});
