import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { actionItems, type ActionStatus } from "@/db/schema";
import { assertAdmin, NotFoundError, resolveClientId, type Viewer } from "./viewer";
import { notifyDashActivity } from "@/lib/webhook";

// "Your to-dos": things only the client can do (verify Google, sign the agreement), each with
// steps to follow. The agency writes them; the client ticks them off.

export type TodoInput = {
  title: string;
  why?: string;
  steps?: string;
  linkUrl?: string | null;
  linkLabel?: string | null;
  dueOn?: string | null;
  sort?: number;
};

export async function listTodos(viewer: Viewer, clientId?: string) {
  const id = await resolveClientId(viewer, clientId);
  return db
    .select()
    .from(actionItems)
    .where(eq(actionItems.clientId, id))
    .orderBy(asc(actionItems.status), asc(actionItems.sort), desc(actionItems.createdAt));
}

export async function countOpenTodos(viewer: Viewer, clientId?: string) {
  const id = await resolveClientId(viewer, clientId);
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(actionItems)
    .where(and(eq(actionItems.clientId, id), eq(actionItems.status, "open")));
  return row?.n ?? 0;
}

function clean(input: TodoInput) {
  const url = input.linkUrl?.trim() || null;
  if (url && !/^https:\/\//.test(url)) throw new Error("Links must start with https://");
  return {
    title: input.title.trim(),
    why: input.why?.trim() ?? "",
    steps: input.steps?.trim() ?? "",
    linkUrl: url,
    linkLabel: url ? input.linkLabel?.trim() || "Open" : null,
    dueOn: input.dueOn || null,
    sort: input.sort ?? 0,
  };
}

async function loadTodo(viewer: Viewer, todoId: string) {
  const [row] = await db
    .select()
    .from(actionItems)
    .where(and(eq(actionItems.id, todoId), eq(actionItems.agencyId, viewer.agencyId)));
  if (!row) throw new NotFoundError();
  if (viewer.role === "client" && row.clientId !== viewer.clientId) throw new NotFoundError();
  return row;
}

/** Create a to-do, or update one when todoId is given. Admin only. */
export async function saveTodo(viewer: Viewer, clientId: string, input: TodoInput, todoId?: string) {
  assertAdmin(viewer);
  const id = await resolveClientId(viewer, clientId);
  const values = clean(input);
  if (todoId) {
    const todo = await loadTodo(viewer, todoId);
    if (todo.clientId !== id) throw new NotFoundError();
    await db.update(actionItems).set({ ...values, updatedAt: new Date() }).where(eq(actionItems.id, todo.id));
    return todo.id;
  }
  const [row] = await db
    .insert(actionItems)
    .values({ agencyId: viewer.agencyId, clientId: id, ...values })
    .returning({ id: actionItems.id });
  return row!.id;
}

/** Either side can tick a to-do off or reopen it. */
export async function setTodoStatus(viewer: Viewer, todoId: string, status: ActionStatus) {
  const todo = await loadTodo(viewer, todoId);
  await db
    .update(actionItems)
    .set({
      status,
      doneAt: status === "done" ? new Date() : null,
      doneById: status === "done" ? viewer.userId : null,
      updatedAt: new Date(),
    })
    .where(eq(actionItems.id, todo.id));
  if (viewer.role === "client") notifyDashActivity("todo.updated", todo.clientId, { title: todo.title, status });
}

export async function deleteTodo(viewer: Viewer, todoId: string) {
  assertAdmin(viewer);
  const todo = await loadTodo(viewer, todoId);
  await db.delete(actionItems).where(eq(actionItems.id, todo.id));
}
