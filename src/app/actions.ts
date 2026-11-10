"use server";

// Server actions shared by the client portal and the admin side.
// Every action resolves the viewer from the session; the data layer enforces
// which agency/client they may touch, so a tampered clientId just 404s.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin, requireViewer } from "@/lib/auth/session";
import type { Viewer } from "@/lib/data/viewer";
import * as clientsData from "@/lib/data/clients";
import * as requestsData from "@/lib/data/requests";
import * as messagesData from "@/lib/data/messages";
import * as filesData from "@/lib/data/files";
import * as updatesData from "@/lib/data/updates";
import * as invoicesData from "@/lib/data/invoices";
import * as signupsData from "@/lib/data/signups";
import * as statsData from "@/lib/data/stats";
import * as todosData from "@/lib/data/todos";
import * as intakeData from "@/lib/data/intake";
import type { IntakeResult } from "@/components/features/IntakeFlow";
import { requestStatus, invoiceStatus } from "@/db/schema";

export type ActionState = { error?: string; resetUrl?: string; ok?: boolean } | undefined;

const optionalId = z.string().uuid().optional().or(z.literal("").transform(() => undefined));

function parse<T extends z.ZodTypeAny>(schema: T, formData: FormData): z.infer<T> {
  return schema.parse(Object.fromEntries(formData));
}

function basePath(viewer: Viewer, clientId?: string) {
  return viewer.role === "client" ? "/portal" : `/admin/clients/${clientId}`;
}

function refresh() {
  revalidatePath("/", "layout");
}

/** Postgres unique_violation on a given index. Drizzle wraps the pg error in `cause`. */
function isUniqueViolation(err: unknown, constraint: string): boolean {
  for (let e = err as { code?: string; constraint?: string; cause?: unknown } | undefined; e; e = e.cause as typeof e) {
    if (e.code === "23505" && e.constraint === constraint) return true;
  }
  return false;
}

function resetUrl(token: string) {
  return `${process.env.APP_URL || "http://localhost:3000"}/reset/${token}`;
}

// ---- Requests ----

export async function createRequestAction(formData: FormData) {
  const viewer = await requireViewer();
  const input = parse(
    z.object({ title: z.string().trim().min(1).max(200), details: z.string().trim().max(5000).default(""), clientId: optionalId }),
    formData,
  );
  const id = await requestsData.createRequest(viewer, input, input.clientId);
  refresh();
  redirect(`${basePath(viewer, input.clientId)}/requests/${id}`);
}

export async function addCommentAction(formData: FormData) {
  const viewer = await requireViewer();
  const input = parse(z.object({ requestId: z.string().uuid(), body: z.string().trim().min(1).max(5000) }), formData);
  await requestsData.addRequestComment(viewer, input.requestId, input.body);
  refresh();
}

export async function approveRequestAction(formData: FormData) {
  const viewer = await requireViewer();
  const input = parse(z.object({ requestId: z.string().uuid() }), formData);
  await requestsData.approveRequest(viewer, input.requestId);
  refresh();
}

export async function setRequestStatusAction(formData: FormData) {
  const viewer = await requireAdmin();
  const input = parse(z.object({ requestId: z.string().uuid(), status: z.enum(requestStatus.enumValues) }), formData);
  await requestsData.setRequestStatus(viewer, input.requestId, input.status);
  refresh();
}

// ---- Messages ----

export async function sendMessageAction(formData: FormData) {
  const viewer = await requireViewer();
  const input = parse(z.object({ body: z.string().trim().min(1).max(5000), clientId: optionalId }), formData);
  await messagesData.sendMessage(viewer, input.body, input.clientId);
  refresh();
}

// ---- Files ----

export async function uploadFileAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await requireViewer();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a file to upload." };
  if (file.size > filesData.MAX_UPLOAD_BYTES) return { error: "Files can be up to 25 MB." };
  const clientId = optionalId.parse(formData.get("clientId") ?? undefined);
  try {
    await filesData.uploadFile(
      viewer,
      {
        name: file.name.slice(0, 255),
        mimeType: file.type,
        data: Buffer.from(await file.arrayBuffer()),
        needsApproval: formData.get("needsApproval") === "on",
        folder: formData.get("folder") === "brand" ? "brand" : "",
      },
      clientId,
    );
  } catch (err) {
    if (err instanceof filesData.StorageFullError) {
      return { error: "File storage is full. Ask your agency to make room before uploading more." };
    }
    throw err;
  }
  refresh();
  return { ok: true };
}

export async function respondToFileAction(formData: FormData) {
  const viewer = await requireViewer();
  const input = parse(z.object({ fileId: z.string().uuid(), decision: z.enum(["approved", "changes_requested"]) }), formData);
  await filesData.respondToFile(viewer, input.fileId, input.decision);
  refresh();
}

export async function deleteFileAction(formData: FormData) {
  const viewer = await requireAdmin();
  const input = parse(z.object({ fileId: z.string().uuid() }), formData);
  await filesData.deleteFile(viewer, input.fileId);
  refresh();
}

// ---- Admin: clients ----

const clientFields = {
  name: z.string().trim().min(1, "Business name is required.").max(200),
  websiteUrl: z.string().trim().max(500).optional(),
  planName: z.string().trim().max(200).optional(),
};

export async function createClientAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await requireAdmin();
  const parsed = z.object(clientFields).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const client = await clientsData.createClient(viewer, parsed.data);
  refresh();
  redirect(`/admin/clients/${client.id}`);
}

export async function updateClientAction(formData: FormData) {
  const viewer = await requireAdmin();
  const input = parse(z.object({ clientId: z.string().uuid(), ...clientFields }), formData);
  await clientsData.updateClient(viewer, input.clientId, input);
  refresh();
}

export async function resetLinkAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await requireAdmin();
  const input = parse(z.object({ userId: z.string().uuid() }), formData);
  const token = await clientsData.createPasswordResetLink(viewer, input.userId);
  return { ok: true, resetUrl: resetUrl(token) };
}

export async function removeClientUserAction(formData: FormData) {
  const viewer = await requireAdmin();
  const input = parse(z.object({ userId: z.string().uuid() }), formData);
  await clientsData.removeClientUser(viewer, input.userId);
  refresh();
}

// ---- Admin: sign-ups ----

export async function approveSignupAction(formData: FormData) {
  const viewer = await requireAdmin();
  const input = parse(
    z.object({ userId: z.string().uuid(), target: z.string().min(1), newClientName: z.string().trim().max(200).optional() }),
    formData,
  );
  // target is either "new" or the id of an existing client.
  const clientId =
    input.target === "new"
      ? await signupsData.approveSignup(viewer, input.userId, { newClientName: input.newClientName || "New client" })
      : await signupsData.approveSignup(viewer, input.userId, { clientId: z.string().uuid().parse(input.target) });
  refresh();
  redirect(`/admin/clients/${clientId}`);
}

export async function rejectSignupAction(formData: FormData) {
  const viewer = await requireAdmin();
  const input = parse(z.object({ userId: z.string().uuid() }), formData);
  await signupsData.rejectSignup(viewer, input.userId);
  refresh();
}

// ---- Admin: updates & work log ----

export async function upsertNoteAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await requireAdmin();
  const input = parse(
    z.object({
      clientId: z.string().uuid(),
      month: z.string().regex(/^\d{4}-\d{2}$/),
      wins: z.string().trim().max(5000).default(""),
      workingOn: z.string().trim().max(5000).default(""),
      nextMonth: z.string().trim().max(5000).default(""),
    }),
    formData,
  );
  await updatesData.upsertNote(viewer, input.clientId, input);
  refresh();
  return { ok: true };
}

export async function addWorkLogAction(formData: FormData) {
  const viewer = await requireAdmin();
  const input = parse(
    z.object({
      clientId: z.string().uuid(),
      title: z.string().trim().min(1).max(300),
      tag: z.string().trim().min(1).max(40),
      doneOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }),
    formData,
  );
  await updatesData.addWorkLog(viewer, input.clientId, input);
  refresh();
}

export async function deleteWorkLogAction(formData: FormData) {
  const viewer = await requireAdmin();
  const input = parse(z.object({ entryId: z.string().uuid() }), formData);
  await updatesData.deleteWorkLog(viewer, input.entryId);
  refresh();
}

// ---- Admin: invoices ----

export async function createInvoiceAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await requireAdmin();
  const parsed = z
    .object({
      clientId: z.string().uuid(),
      number: z.string().trim().min(1, "Invoice number is required.").max(50),
      description: z.string().trim().max(500).default(""),
      amount: z.coerce.number().positive("Amount must be more than 0."),
      issuedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick an issue date."),
      dueOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a due date."),
      status: z.enum(invoiceStatus.enumValues),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const { amount, clientId, ...rest } = parsed.data;
  try {
    await invoicesData.createInvoice(viewer, clientId, { ...rest, amountCents: Math.round(amount * 100) });
  } catch (err) {
    if (isUniqueViolation(err, "invoices_agency_number_idx")) return { error: "That invoice number is already used." };
    throw err;
  }
  refresh();
  return { ok: true };
}

export async function setInvoiceStatusAction(formData: FormData) {
  const viewer = await requireAdmin();
  const input = parse(z.object({ invoiceId: z.string().uuid(), status: z.enum(invoiceStatus.enumValues) }), formData);
  await invoicesData.setInvoiceStatus(viewer, input.invoiceId, input.status);
  refresh();
}

export async function setPaymentInstructionsAction(formData: FormData) {
  const viewer = await requireAdmin();
  const input = parse(z.object({ text: z.string().trim().max(1000).default("") }), formData);
  await clientsData.setPaymentInstructions(viewer, input.text);
  refresh();
}

// ---- To-dos ----

export async function setTodoStatusAction(formData: FormData) {
  const viewer = await requireViewer();
  const input = parse(z.object({ todoId: z.string().uuid(), status: z.enum(["open", "done"]) }), formData);
  await todosData.setTodoStatus(viewer, input.todoId, input.status);
  refresh();
}

export async function saveTodoAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await requireAdmin();
  const parsed = z
    .object({
      clientId: z.string().uuid(),
      todoId: optionalId,
      title: z.string().trim().min(1, "Give it a title.").max(200),
      why: z.string().trim().max(2000).default(""),
      steps: z.string().trim().max(8000).default(""),
      linkUrl: z.string().trim().max(500).default(""),
      linkLabel: z.string().trim().max(60).default(""),
      dueOn: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/).default(""),
      sort: z.coerce.number().int().min(0).max(1000).default(0),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const { clientId, todoId, dueOn, ...rest } = parsed.data;
  try {
    await todosData.saveTodo(viewer, clientId, { ...rest, dueOn: dueOn || null }, todoId);
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("Links must")) return { error: err.message };
    throw err;
  }
  refresh();
  return { ok: true };
}

export async function deleteTodoAction(formData: FormData) {
  const viewer = await requireAdmin();
  const input = parse(z.object({ todoId: z.string().uuid() }), formData);
  await todosData.deleteTodo(viewer, input.todoId);
  refresh();
}

// ---- Admin: analytics source and logins ----

export async function setStatsSourceAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await requireAdmin();
  const input = parse(
    z.object({ clientId: z.string().uuid(), statsUrl: z.string().trim().max(500).default(""), statsToken: z.string().trim().max(500).default("") }),
    formData,
  );
  try {
    await statsData.setStatsSource(viewer, input.clientId, input);
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("Stats URL")) return { error: err.message };
    throw err;
  }
  refresh();
  return { ok: true };
}

export async function createClientUserAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await requireAdmin();
  const parsed = z
    .object({
      clientId: z.string().uuid(),
      email: z.string().trim().email("Enter an email address.").max(320),
      name: z.string().trim().min(1, "Enter their name.").max(200),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const { clientId, ...input } = parsed.data;
  try {
    const { token } = await clientsData.createClientUser(viewer, clientId, input);
    refresh();
    return { ok: true, resetUrl: resetUrl(token) };
  } catch (err) {
    if (err instanceof clientsData.EmailTakenError) return { error: err.message };
    throw err;
  }
}

// ---- Your project: the design pick and the intake answers, once the client has a login ----

export async function saveIntakePickAction(slug: string, note: string): Promise<IntakeResult> {
  const viewer = await requireViewer();
  if (viewer.role !== "client") return { ok: false, error: "This is a preview, so nothing can be changed here." };
  await intakeData.saveIntake(viewer, { templateSlug: z.string().max(40).parse(slug), templateNote: z.string().max(2000).parse(note) });
  refresh();
  return { ok: true };
}

export async function saveIntakeAnswersAction(answers: Record<string, string>, submit: boolean): Promise<IntakeResult> {
  const viewer = await requireViewer();
  if (viewer.role !== "client") return { ok: false, error: "This is a preview, so nothing can be changed here." };
  await intakeData.saveIntake(viewer, { answers: z.record(z.string().max(40), z.string().max(4000)).parse(answers), submit });
  if (submit) refresh();
  return { ok: true };
}
