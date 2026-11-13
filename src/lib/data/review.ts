import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { changeNotes, clients, files, intakes, requests, type NoteAnchor } from "@/db/schema";
import { notifyDash } from "@/lib/webhook";
import { defaultTitle, describeNotes, NOTE_KINDS, type NoteKind, type NoteSource } from "@/lib/review/describe";
import { assertAdmin, ForbiddenError, NotFoundError, resolveClientId, type Viewer } from "./viewer";

// "Request website changes": notes a client pins on their own site (or on the design they
// picked). They collect in a draft, one per client and source, until the client sends them;
// sending makes one ordinary request and files the notes under it, so the rest of the request
// flow (status, replies, approval, LMS Dash) works unchanged.

export const MAX_DRAFT_NOTES = 60;
const MAX_STROKES = 24;
const MAX_STROKE_NUMBERS = 1200;

export class TooManyNotesError extends Error {
  constructor() {
    super(`A request can hold up to ${MAX_DRAFT_NOTES} notes. Send these first.`);
  }
}

export type NoteInput = {
  kind: NoteKind;
  pagePath: string;
  pageTitle?: string;
  anchor?: NoteAnchor | null;
  viewportW?: number;
  body?: string;
  textBefore?: string | null;
  textAfter?: string | null;
  strokes?: number[][] | null;
  fileId?: string | null;
};

const noteColumns = {
  id: changeNotes.id,
  requestId: changeNotes.requestId,
  source: changeNotes.source,
  kind: changeNotes.kind,
  pagePath: changeNotes.pagePath,
  pageTitle: changeNotes.pageTitle,
  anchor: changeNotes.anchor,
  viewportW: changeNotes.viewportW,
  body: changeNotes.body,
  textBefore: changeNotes.textBefore,
  textAfter: changeNotes.textAfter,
  strokes: changeNotes.strokes,
  fileId: changeNotes.fileId,
  fileName: files.name,
  doneAt: changeNotes.doneAt,
  createdAt: changeNotes.createdAt,
};

export type Note = Awaited<ReturnType<typeof listDraft>>[number];

function num(value: unknown, min: number, max: number, fallback = 0) {
  const n = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.min(max, Math.max(min, n));
}

function cleanPath(path: string) {
  const p = path.split(/[?#]/)[0]!.slice(0, 500);
  return p.startsWith("/") ? p : `/${p}`;
}

function cleanAnchor(a: NoteAnchor | null | undefined): NoteAnchor | null {
  if (!a || typeof a.selector !== "string" || !a.selector) return null;
  return {
    selector: a.selector.slice(0, 600),
    tag: String(a.tag ?? "").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 30),
    text: String(a.text ?? "").replace(/\s+/g, " ").trim().slice(0, 300),
    rx: num(a.rx, -4, 5, 0.5),
    ry: num(a.ry, -4, 5, 0.5),
    docX: Math.round(num(a.docX, 0, 100000)),
    docY: Math.round(num(a.docY, 0, 1000000)),
    w: Math.round(num(a.w, 0, 100000)),
    h: Math.round(num(a.h, 0, 1000000)),
  };
}

function cleanStrokes(strokes: number[][] | null | undefined): number[][] | null {
  if (!Array.isArray(strokes)) return null;
  const out = strokes
    .slice(0, MAX_STROKES)
    .filter((s) => Array.isArray(s) && s.length >= 4)
    .map((s) => s.slice(0, MAX_STROKE_NUMBERS).map((v) => Math.round(num(v, -50, 50) * 10000) / 10000));
  return out.length ? out : null;
}

function mustBeClient(viewer: Viewer) {
  // An admin looking through "View as client" renders the page but never writes as the client.
  if (viewer.role !== "client" || viewer.status !== "active" || viewer.previewBy) throw new ForbiddenError();
}

/** The notes a client has made but not sent yet, oldest first. */
export async function listDraft(viewer: Viewer, source: NoteSource, clientId?: string) {
  const id = await resolveClientId(viewer, clientId);
  return db
    .select(noteColumns)
    .from(changeNotes)
    .leftJoin(files, eq(files.id, changeNotes.fileId))
    .where(and(eq(changeNotes.clientId, id), isNull(changeNotes.requestId), eq(changeNotes.source, source)))
    .orderBy(asc(changeNotes.createdAt), asc(changeNotes.id));
}

/** Notes filed under requests. No access check: callers have already loaded the requests. */
export async function notesForRequests(requestIds: string[]) {
  if (requestIds.length === 0) return [];
  return db
    .select(noteColumns)
    .from(changeNotes)
    .leftJoin(files, eq(files.id, changeNotes.fileId))
    .where(inArray(changeNotes.requestId, requestIds))
    .orderBy(asc(changeNotes.createdAt), asc(changeNotes.id));
}

/** How many requests' worth of notes: { requestId: [done, total] }. For request lists. */
export async function noteCounts(requestIds: string[]) {
  if (requestIds.length === 0) return new Map<string, { done: number; total: number }>();
  const rows = await db
    .select({
      requestId: changeNotes.requestId,
      total: sql<number>`count(*)::int`,
      done: sql<number>`count(${changeNotes.doneAt})::int`,
    })
    .from(changeNotes)
    .where(inArray(changeNotes.requestId, requestIds))
    .groupBy(changeNotes.requestId);
  return new Map(rows.map((r) => [r.requestId!, { done: r.done, total: r.total }]));
}

export async function addNote(viewer: Viewer, source: NoteSource, input: NoteInput) {
  mustBeClient(viewer);
  const clientId = await resolveClientId(viewer);
  if (!NOTE_KINDS.includes(input.kind)) throw new Error("Unknown kind of note");
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(changeNotes)
    .where(and(eq(changeNotes.clientId, clientId), isNull(changeNotes.requestId), eq(changeNotes.source, source)));
  if (n >= MAX_DRAFT_NOTES) throw new TooManyNotesError();

  const anchor = input.kind === "page" ? null : cleanAnchor(input.anchor);
  if (input.kind !== "page" && !anchor) throw new Error("That note isn't attached to anything on the page");
  const body = (input.body ?? "").trim().slice(0, 2000);
  const before = input.kind === "text" ? (input.textBefore ?? "").slice(0, 2000) : null;
  const after = input.kind === "text" ? (input.textAfter ?? "").slice(0, 2000) : null;
  if (input.kind === "text" && before === after) throw new Error("The wording didn't change");
  const strokes = input.kind === "draw" ? cleanStrokes(input.strokes) : null;
  if (input.kind === "draw" && !strokes) throw new Error("The drawing is empty");

  let fileId: string | null = null;
  if (input.fileId) {
    // Only a file of this client's can be attached.
    const [file] = await db.select({ id: files.id }).from(files).where(and(eq(files.id, input.fileId), eq(files.clientId, clientId)));
    if (!file) throw new NotFoundError();
    fileId = file.id;
  }
  if ((input.kind === "pin" || input.kind === "page" || input.kind === "draw") && !body && !fileId) {
    throw new Error("Say what should change");
  }

  const [row] = await db
    .insert(changeNotes)
    .values({
      agencyId: viewer.agencyId,
      clientId,
      authorId: viewer.userId,
      source,
      kind: input.kind,
      pagePath: cleanPath(input.pagePath || "/"),
      pageTitle: (input.pageTitle ?? "").replace(/\s+/g, " ").trim().slice(0, 200),
      anchor,
      viewportW: Math.round(num(input.viewportW, 0, 10000)),
      body,
      textBefore: before,
      textAfter: after,
      strokes,
      fileId,
    })
    .returning({ id: changeNotes.id });
  return row!.id;
}

async function loadDraftNote(viewer: Viewer, noteId: string) {
  mustBeClient(viewer);
  const [row] = await db
    .select()
    .from(changeNotes)
    .where(and(eq(changeNotes.id, noteId), eq(changeNotes.clientId, viewer.clientId!), isNull(changeNotes.requestId)));
  if (!row) throw new NotFoundError();
  return row;
}

/** Change what a draft note says. Sent notes are part of the request and stay as they were. */
export async function updateNote(viewer: Viewer, noteId: string, body: string) {
  const note = await loadDraftNote(viewer, noteId);
  const text = body.trim().slice(0, 2000);
  if (!text && note.kind !== "text" && !note.fileId) throw new Error("Say what should change");
  await db.update(changeNotes).set({ body: text }).where(eq(changeNotes.id, note.id));
}

export async function deleteNote(viewer: Viewer, noteId: string) {
  const note = await loadDraftNote(viewer, noteId);
  await db.delete(changeNotes).where(eq(changeNotes.id, note.id));
}

export class EmptyDraftError extends Error {
  constructor() {
    super("There is nothing to send yet");
  }
}

/** Send the draft: one request, with every draft note filed under it. Returns the request id. */
export async function submitDraft(viewer: Viewer, source: NoteSource, input: { title?: string; neededBy?: string | null } = {}) {
  mustBeClient(viewer);
  const clientId = await resolveClientId(viewer);
  const result = await db.transaction(async (tx) => {
    const notes = await tx
      .select(noteColumns)
      .from(changeNotes)
      .leftJoin(files, eq(files.id, changeNotes.fileId))
      .where(and(eq(changeNotes.clientId, clientId), isNull(changeNotes.requestId), eq(changeNotes.source, source)))
      .orderBy(asc(changeNotes.createdAt), asc(changeNotes.id))
      .for("update", { of: changeNotes });
    if (notes.length === 0) throw new EmptyDraftError();
    const title = (input.title ?? "").trim().slice(0, 200) || defaultTitle(notes.length, source);
    const details = describeNotes(notes, { source, neededBy: input.neededBy }).slice(0, 20000);
    const [request] = await tx
      .insert(requests)
      .values({ agencyId: viewer.agencyId, clientId, title, details, createdById: viewer.userId })
      .returning({ id: requests.id });
    await tx
      .update(changeNotes)
      .set({ requestId: request!.id })
      .where(inArray(changeNotes.id, notes.map((n) => n.id)));
    return { id: request!.id, title };
  });
  notifyDash("request.created", { id: result.id, clientId, title: result.title, status: "received" });
  return result.id;
}

/** The agency ticks a note off as it works through a request. The client sees the tick. */
export async function setNoteDone(viewer: Viewer, noteId: string, done: boolean) {
  assertAdmin(viewer);
  const [row] = await db
    .select({ note: changeNotes, request: requests })
    .from(changeNotes)
    .innerJoin(requests, eq(requests.id, changeNotes.requestId))
    .where(and(eq(changeNotes.id, noteId), eq(changeNotes.agencyId, viewer.agencyId)));
  if (!row) throw new NotFoundError();
  await db.transaction(async (tx) => {
    await tx
      .update(changeNotes)
      .set({ doneAt: done ? new Date() : null, doneById: done ? viewer.userId : null })
      .where(eq(changeNotes.id, row.note.id));
    await tx.update(requests).set({ updatedAt: new Date() }).where(eq(requests.id, row.request.id));
  });
  notifyDash("request.updated", row.request);
  return { requestId: row.request.id };
}

/**
 * What the review frame loads for a client: their site (the preview build when one is set,
 * else the live site) or the design they picked. Not viewer-scoped: the frame's signed
 * token already names the client (src/lib/review/token.ts).
 */
export async function reviewTarget(clientId: string) {
  const [row] = await db
    .select({
      name: clients.name,
      websiteUrl: clients.websiteUrl,
      reviewUrl: clients.reviewUrl,
      templateSlug: intakes.templateSlug,
      answers: intakes.answers,
    })
    .from(clients)
    .leftJoin(intakes, eq(intakes.clientId, clients.id))
    .where(eq(clients.id, clientId));
  if (!row) return null;
  return {
    name: row.name,
    siteUrl: row.reviewUrl || row.websiteUrl || null,
    templateSlug: row.templateSlug,
    phone: row.answers?.phone ?? null,
  };
}
