import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { apiTokens, users } from "@/db/schema";
import { randomToken, sha256 } from "./crypto";
import type { Viewer } from "@/lib/data/viewer";

// API tokens let an MCP client (Claude) act as an agency admin through /api/mcp.
// Only the sha256 is stored; the raw token is returned once, when it is created.

const PREFIX = "lmsp_";

export class NotAdminError extends Error {
  constructor() {
    super("API tokens are only for active agency admins");
  }
}

export async function createApiToken(userId: string, label: string): Promise<string> {
  const [user] = await db.select({ role: users.role, status: users.status }).from(users).where(eq(users.id, userId));
  if (user?.role !== "agency_admin" || user.status !== "active") throw new NotAdminError();
  const token = PREFIX + randomToken();
  await db.insert(apiTokens).values({ tokenHash: sha256(token), userId, label });
  return token;
}

export async function listApiTokens(userId: string) {
  return db
    .select({ label: apiTokens.label, createdAt: apiTokens.createdAt, lastUsedAt: apiTokens.lastUsedAt })
    .from(apiTokens)
    .where(eq(apiTokens.userId, userId));
}

/** Returns how many tokens were removed. */
export async function revokeApiTokens(userId: string, label?: string): Promise<number> {
  const where = label ? and(eq(apiTokens.userId, userId), eq(apiTokens.label, label)) : eq(apiTokens.userId, userId);
  const removed = await db.delete(apiTokens).where(where).returning({ tokenHash: apiTokens.tokenHash });
  return removed.length;
}

/** The admin a bearer token belongs to, or null. A demoted or pending user's tokens stop working. */
export async function viewerFromApiToken(token: string): Promise<Viewer | null> {
  if (!token.startsWith(PREFIX)) return null;
  const tokenHash = sha256(token);
  const [row] = await db
    .select({
      userId: users.id,
      agencyId: users.agencyId,
      role: users.role,
      status: users.status,
      clientId: users.clientId,
      name: users.name,
      email: users.email,
    })
    .from(apiTokens)
    .innerJoin(users, eq(users.id, apiTokens.userId))
    .where(eq(apiTokens.tokenHash, tokenHash));
  if (!row || row.role !== "agency_admin" || row.status !== "active") return null;
  await db.update(apiTokens).set({ lastUsedAt: new Date() }).where(eq(apiTokens.tokenHash, tokenHash));
  return row;
}
