import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import { randomToken, sha256, verifyPassword } from "./crypto";
import { NotFoundError, type Viewer } from "@/lib/data/viewer";
import { previewViewer } from "@/lib/data/preview";

const COOKIE = "lms_session";
const PREVIEW_COOKIE = "lms_preview";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REMEMBERED_TTL_MS = 30 * 24 * 60 * 60 * 1000;
// Without "remember me" the cookie dies with the browser, and the server
// drops the session after this long even if the browser stays open.
const BROWSER_SESSION_TTL_MS = 12 * 60 * 60 * 1000;

function cookieOptions(expires?: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.COOKIE_SECURE !== "false",
    path: "/",
    ...(expires && { expires }),
  };
}

export async function startSession(userId: string, remember = true) {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + (remember ? REMEMBERED_TTL_MS : BROWSER_SESSION_TTL_MS));
  await db.insert(sessions).values({ id: sha256(token), userId, expiresAt });
  (await cookies()).set(COOKIE, token, cookieOptions(remember ? expiresAt : undefined));
}

export async function endSession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.id, sha256(token)));
  jar.delete(COOKIE);
}

/** Returns the user id on success. Same error for unknown email and wrong password. */
export async function checkCredentials(email: string, password: string): Promise<string | null> {
  const [user] = await db
    .select({ id: users.id, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.email, email.toLowerCase()));
  if (!user?.passwordHash) return null;
  return (await verifyPassword(password, user.passwordHash)) ? user.id : null;
}

export const getViewer = cache(async (): Promise<Viewer | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
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
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, sha256(token)), gt(sessions.expiresAt, new Date())));
  return row ?? null;
});

/** Logged in and approved. Pending sign-ups are sent to the waiting page. */
export async function requireViewer(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  if (viewer.status !== "active") redirect("/pending");
  return viewer;
}

export function homePath(viewer: Viewer) {
  if (viewer.status !== "active") return "/pending";
  return viewer.role === "agency_admin" ? "/admin" : "/portal";
}

export async function requireAdmin(): Promise<Viewer> {
  const viewer = await requireViewer();
  if (viewer.role !== "agency_admin") redirect("/portal");
  return viewer;
}

/** Real clients, or an admin who opened "View as client". */
export async function requireClient(): Promise<Viewer> {
  const viewer = await requireViewer();
  if (viewer.role === "client") return viewer;
  const preview = await getPreview(viewer);
  if (!preview) redirect("/admin");
  return preview;
}

// ---- "View as client" ----
// A second cookie holding "clientId" or "clientId:userId". It only changes how
// /portal pages render for an admin; admin pages and server actions ignore it.

export async function startPreview(clientId: string, userId?: string) {
  (await cookies()).set(PREVIEW_COOKIE, userId ? `${clientId}:${userId}` : clientId, cookieOptions());
}

/** Ends the preview and returns the client id it was showing, if any. */
export async function endPreview(): Promise<string | undefined> {
  const jar = await cookies();
  const clientId = jar.get(PREVIEW_COOKIE)?.value.split(":")[0];
  jar.delete(PREVIEW_COOKIE);
  return clientId;
}

const getPreview = cache(async (admin: Viewer): Promise<Viewer | null> => {
  if (admin.role !== "agency_admin") return null;
  const [clientId, userId] = (await cookies()).get(PREVIEW_COOKIE)?.value.split(":") ?? [];
  if (!clientId || !UUID.test(clientId) || (userId && !UUID.test(userId))) return null;
  try {
    return await previewViewer(admin, clientId, userId);
  } catch (err) {
    if (err instanceof NotFoundError) return null;
    throw err;
  }
});
