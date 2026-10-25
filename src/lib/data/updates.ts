import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { monthlyNotes, workLog } from "@/db/schema";
import { assertAdmin, NotFoundError, resolveClientId, type Viewer } from "./viewer";

// Monthly notes ("Your October update") and the "What we did for you" work log.

export async function getLatestNote(viewer: Viewer, clientId?: string) {
  const id = await resolveClientId(viewer, clientId);
  const [row] = await db
    .select()
    .from(monthlyNotes)
    .where(eq(monthlyNotes.clientId, id))
    .orderBy(desc(monthlyNotes.month))
    .limit(1);
  return row ?? null;
}

export async function listNotes(viewer: Viewer, clientId?: string) {
  const id = await resolveClientId(viewer, clientId);
  return db.select().from(monthlyNotes).where(eq(monthlyNotes.clientId, id)).orderBy(desc(monthlyNotes.month));
}

/** Creates or replaces the note for a month. `month` is YYYY-MM. */
export async function upsertNote(
  viewer: Viewer,
  clientId: string,
  input: { month: string; wins: string; workingOn: string; nextMonth: string },
) {
  assertAdmin(viewer);
  const id = await resolveClientId(viewer, clientId);
  const month = `${input.month}-01`;
  await db
    .insert(monthlyNotes)
    .values({
      agencyId: viewer.agencyId,
      clientId: id,
      month,
      wins: input.wins,
      workingOn: input.workingOn,
      nextMonth: input.nextMonth,
      authorId: viewer.userId,
    })
    .onConflictDoUpdate({
      target: [monthlyNotes.clientId, monthlyNotes.month],
      set: { wins: input.wins, workingOn: input.workingOn, nextMonth: input.nextMonth, authorId: viewer.userId },
    });
}

export async function listWorkLog(viewer: Viewer, clientId?: string, limit = 50) {
  const id = await resolveClientId(viewer, clientId);
  return db
    .select()
    .from(workLog)
    .where(eq(workLog.clientId, id))
    .orderBy(desc(workLog.doneOn), desc(workLog.createdAt))
    .limit(limit);
}

export async function addWorkLog(
  viewer: Viewer,
  clientId: string,
  input: { title: string; tag: string; doneOn: string },
) {
  assertAdmin(viewer);
  const id = await resolveClientId(viewer, clientId);
  await db.insert(workLog).values({ agencyId: viewer.agencyId, clientId: id, ...input });
}

export async function deleteWorkLog(viewer: Viewer, entryId: string) {
  assertAdmin(viewer);
  const deleted = await db
    .delete(workLog)
    .where(and(eq(workLog.id, entryId), eq(workLog.agencyId, viewer.agencyId)))
    .returning({ id: workLog.id });
  if (deleted.length === 0) throw new NotFoundError();
}
