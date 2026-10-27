import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { requestComments, requests, users, type RequestStatus } from "@/db/schema";
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
  return row.id;
}

export async function addRequestComment(viewer: Viewer, requestId: string, body: string) {
  const request = await loadRequest(viewer, requestId);
  await db.transaction(async (tx) => {
    await tx.insert(requestComments).values({ agencyId: viewer.agencyId, requestId: request.id, authorId: viewer.userId, body });
    await tx.update(requests).set({ updatedAt: new Date() }).where(eq(requests.id, request.id));
  });
}

export async function setRequestStatus(viewer: Viewer, requestId: string, status: RequestStatus) {
  assertAdmin(viewer);
  const request = await loadRequest(viewer, requestId);
  await db.update(requests).set({ status, updatedAt: new Date() }).where(eq(requests.id, request.id));
}

/** Client signs off on a change the agency put up for review. */
export async function approveRequest(viewer: Viewer, requestId: string) {
  const request = await loadRequest(viewer, requestId);
  if (request.status !== "review") throw new NotFoundError("Request is not waiting for approval");
  await db.update(requests).set({ status: "done", updatedAt: new Date() }).where(eq(requests.id, request.id));
}
