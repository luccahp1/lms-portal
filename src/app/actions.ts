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
import { requestStatus, invoiceStatus } from "@/db/schema";

export type ActionState = { error?: string; inviteUrl?: string; ok?: boolean } | undefined;

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

function inviteUrl(token: string) {
  return `${process.env.APP_URL || "http://localhost:3000"}/invite/${token}`;
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
  await filesData.uploadFile(
    viewer,
    {
      name: file.name.slice(0, 255),
      mimeType: file.type,
      data: Buffer.from(await file.arrayBuffer()),
      needsApproval: formData.get("needsApproval") === "on",
    },
    clientId,
  );
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
  const parsed = z
    .object({
      ...clientFields,
      contactName: z.string().trim().min(1, "Contact name is required.").max(200),
      contactEmail: z.string().trim().email("Enter a valid contact email."),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  try {
    const { inviteToken } = await clientsData.createClient(viewer, parsed.data);
    refresh();
    return { ok: true, inviteUrl: inviteUrl(inviteToken) };
  } catch (err) {
    if (isUniqueViolation(err, "users_email_idx")) return { error: "Someone already uses that email address." };
    throw err;
  }
}

export async function updateClientAction(formData: FormData) {
  const viewer = await requireAdmin();
  const input = parse(z.object({ clientId: z.string().uuid(), ...clientFields }), formData);
  await clientsData.updateClient(viewer, input.clientId, input);
  refresh();
}

export async function reinviteAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await requireAdmin();
  const input = parse(z.object({ userId: z.string().uuid() }), formData);
  const token = await clientsData.reinviteClientUser(viewer, input.userId);
  return { ok: true, inviteUrl: inviteUrl(token) };
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
