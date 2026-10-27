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
 */
export async function resolveClientId(viewer: Viewer, clientId?: string): Promise<string> {
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
}
