import { and, asc, desc, eq, gt, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { clients, requestComments, requests, users, type RequestStatus } from "@/db/schema";
import { notifyDash } from "@/lib/webhook";
import { assertAdmin, NotFoundError, resolveClientId, type Viewer } from "./viewer";

export async function listRequests(viewer: Viewer, clientId?: string) {
  const id = await resolveClientId(viewer, clientId);
  return db
    .select({
      id: requests.id,
      title: requests.title,
      status: requests.status,
      createdAt: requests.createdAt,
      updatedAt: requests.updatedAt,
      commentCount: sql<number>`(select count(*)::int from ${requestComments} where ${requestComments.requestId} = ${requests.id})`,
    })
    .from(requests)
    .where(eq(requests.clientId, id))
    .orderBy(desc(requests.createdAt));
}

/** Requests across all of an agency's clients, newest activity first. Admin inbox. */
export async function listAgencyOpenRequests(viewer: Viewer) {
  assertAdmin(viewer);
  return db
    .select({
      id: requests.id,
      clientId: requests.clientId,
      title: requests.title,
      status: requests.status,
      updatedAt: requests.updatedAt,
    })
    .from(requests)
    .where(and(eq(requests.agencyId, viewer.agencyId), sql`${requests.status} <> 'done'`))
    .orderBy(desc(requests.updatedAt));
}

async function loadRequest(viewer: Viewer, requestId: string) {
  const [row] = await db
    .select()
    .from(requests)
    .where(and(eq(requests.id, requestId), eq(requests.agencyId, viewer.agencyId)));
  if (!row) throw new NotFoundError();
  if (viewer.role === "client" && row.clientId !== viewer.clientId) throw new NotFoundError();
  return row;
}

export async function getRequest(viewer: Viewer, requestId: string) {
  const request = await loadRequest(viewer, requestId);
  const comments = await db
    .select({
      id: requestComments.id,
      body: requestComments.body,
      createdAt: requestComments.createdAt,
      authorName: users.name,
      authorRole: users.role,
    })
    .from(requestComments)
    .leftJoin(users, eq(users.id, requestComments.authorId))
    .where(eq(requestComments.requestId, request.id))
    .orderBy(asc(requestComments.createdAt));
  return { request, comments };
}

export async function createRequest(viewer: Viewer, input: { title: string; details: string }, clientId?: string) {
  const id = await resolveClientId(viewer, clientId);
  const [row] = await db
    .insert(requests)
    .values({ agencyId: viewer.agencyId, clientId: id, title: input.title, details: input.details, createdById: viewer.userId })
    .returning({ id: requests.id });
  notifyDash("request.created", { id: row.id, clientId: id, title: input.title, status: "received" });
  return row.id;
}

export async function addRequestComment(viewer: Viewer, requestId: string, body: string) {
  const request = await loadRequest(viewer, requestId);
  await db.transaction(async (tx) => {
    await tx.insert(requestComments).values({ agencyId: viewer.agencyId, requestId: request.id, authorId: viewer.userId, body });
    await tx.update(requests).set({ updatedAt: new Date() }).where(eq(requests.id, request.id));
  });
  notifyDash("request.commented", request);
}

export async function setRequestStatus(viewer: Viewer, requestId: string, status: RequestStatus) {
  assertAdmin(viewer);
  const request = await loadRequest(viewer, requestId);
  await db.update(requests).set({ status, updatedAt: new Date() }).where(eq(requests.id, request.id));
  notifyDash("request.updated", { ...request, status });
}

/** Client signs off on a change the agency put up for review. */
export async function approveRequest(viewer: Viewer, requestId: string) {
  const request = await loadRequest(viewer, requestId);
  if (request.status !== "review") throw new NotFoundError("Request is not waiting for approval");
  await db.update(requests).set({ status: "done", updatedAt: new Date() }).where(eq(requests.id, request.id));
  notifyDash("request.updated", { ...request, status: "done" });
}

/** Admin only. For test tickets and spam; real requests are closed with status done. */
export async function deleteRequest(viewer: Viewer, requestId: string) {
  assertAdmin(viewer);
  const request = await loadRequest(viewer, requestId);
  await db.delete(requests).where(eq(requests.id, request.id));
  notifyDash("request.deleted", request);
}

/**
 * Every request across the agency that changed after `since` (all of them without it), with
 * client name, details and the comment thread. LMS Dash resyncs its ticket list with this.
 */
export async function listRequestActivity(viewer: Viewer, since?: Date, limit = 200) {
  assertAdmin(viewer);
  const where = since
    ? and(eq(requests.agencyId, viewer.agencyId), gt(requests.updatedAt, since))
    : eq(requests.agencyId, viewer.agencyId);
  const rows = await db
    .select({
      id: requests.id,
      clientId: requests.clientId,
      clientName: clients.name,
      title: requests.title,
      details: requests.details,
      status: requests.status,
      createdAt: requests.createdAt,
      updatedAt: requests.updatedAt,
      createdByName: users.name,
    })
    .from(requests)
    .innerJoin(clients, eq(clients.id, requests.clientId))
    .leftJoin(users, eq(users.id, requests.createdById))
    .where(where)
    .orderBy(desc(requests.updatedAt))
    .limit(limit);
  if (rows.length === 0) return [];
  const comments = await db
    .select({
      id: requestComments.id,
      requestId: requestComments.requestId,
      body: requestComments.body,
      createdAt: requestComments.createdAt,
      authorName: users.name,
      authorRole: users.role,
    })
    .from(requestComments)
    .leftJoin(users, eq(users.id, requestComments.authorId))
    .where(inArray(requestComments.requestId, rows.map((r) => r.id)))
    .orderBy(asc(requestComments.createdAt));
  return rows.map((r) => ({
    ...r,
    comments: comments
      .filter((c) => c.requestId === r.id)
      .map((c) => ({ id: c.id, body: c.body, createdAt: c.createdAt, authorName: c.authorName, authorRole: c.authorRole })),
  }));
}
