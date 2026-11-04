import { cache } from "react";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { clients } from "@/db/schema";

// The logged-in user, as every data function sees them.
export type Viewer = {
  userId: string;
  agencyId: string;
  role: "agency_admin" | "client";
  status: "pending" | "active";
  clientId: string | null;
  name: string;
  email: string;
  /** Set when an admin is looking at the client portal through "View as client". */
  previewBy?: string;
};

export class NotFoundError extends Error {
  constructor(what = "Not found") {
    super(what);
  }
}

export class ForbiddenError extends Error {
  constructor(what = "Forbidden") {
    super(what);
  }
}

export function assertAdmin(viewer: Viewer) {
  if (viewer.role !== "agency_admin" || viewer.status !== "active") throw new ForbiddenError();
}

/**
 * Resolve which client a viewer may act on.
 * Clients are pinned to their own client. Admins may act on any client of their agency.
 *
 * Reads that a layout and its page both make (this check, the agency, the nav badges) are
 * wrapped in React's cache(), so one page view runs each of them once. The cache lasts for
 * one server render only; server actions and the MCP endpoint call straight through.
 */
export const resolveClientId = cache(async function resolveClientId(viewer: Viewer, clientId?: string): Promise<string> {
  if (viewer.role === "client") {
    if (viewer.status !== "active" || !viewer.clientId) throw new ForbiddenError();
    if (clientId && clientId !== viewer.clientId) throw new NotFoundError();
    return viewer.clientId;
  }
  if (!clientId) throw new NotFoundError();
  const [row] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(and(eq(clients.id, clientId), eq(clients.agencyId, viewer.agencyId)));
  if (!row) throw new NotFoundError();
  return row.id;
});
