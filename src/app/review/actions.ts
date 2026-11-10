"use server";

// Server actions for "Request website changes". Each resolves the real signed-in viewer;
// the data layer (src/lib/data/review.ts) refuses anyone who is not that client.

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireViewer } from "@/lib/auth/session";
import * as reviewData from "@/lib/data/review";
import * as filesData from "@/lib/data/files";
import { ForbiddenError, NotFoundError } from "@/lib/data/viewer";
import { NOTE_KINDS } from "@/lib/review/describe";
import { toClientNote, type ActionResult, type ClientNote } from "./shared";

const source = z.enum(["site", "template"]);
const anchor = z.object({
  selector: z.string().min(1).max(600),
  tag: z.string().max(30),
  text: z.string().max(400),
  rx: z.number(),
  ry: z.number(),
  docX: z.number(),
  docY: z.number(),
  w: z.number(),
  h: z.number(),
});
const noteInput = z.object({
  kind: z.enum(NOTE_KINDS as [string, ...string[]]),
  pagePath: z.string().max(600),
  pageTitle: z.string().max(400).optional(),
  anchor: anchor.nullable().optional(),
  viewportW: z.number().optional(),
  body: z.string().max(2000).optional(),
  textBefore: z.string().max(2000).nullable().optional(),
  textAfter: z.string().max(2000).nullable().optional(),
  strokes: z.array(z.array(z.number()).max(1200)).max(24).nullable().optional(),
  fileId: z.string().uuid().nullable().optional(),
});

function failure(err: unknown): { ok: false; error: string } {
  if (err instanceof ForbiddenError) return { ok: false, error: "This is a preview, so nothing can be changed here." };
  if (err instanceof NotFoundError) return { ok: false, error: "That note is no longer there. Reload the page." };
  if (err instanceof z.ZodError) return { ok: false, error: "That note could not be saved. Try again." };
  if (err instanceof reviewData.TooManyNotesError || err instanceof reviewData.EmptyDraftError) return { ok: false, error: err.message };
  if (err instanceof Error && /^(Say what|The wording|The drawing|That note isn't)/.test(err.message)) return { ok: false, error: err.message };
  throw err;
}

async function draft(viewer: Awaited<ReturnType<typeof requireViewer>>, src: "site" | "template") {
  return (await reviewData.listDraft(viewer, src)).map(toClientNote);
}

type NotesResult = ActionResult<{ notes: ClientNote[] }>;

export async function addNoteAction(src: string, input: unknown, replaces?: string): Promise<NotesResult> {
  const viewer = await requireViewer();
  try {
    const s = source.parse(src);
    const parsed = noteInput.parse(input) as reviewData.NoteInput;
    // A wording edit made again on the same words takes the place of the first one.
    if (replaces && z.string().uuid().safeParse(replaces).success) await reviewData.deleteNote(viewer, replaces).catch(() => {});
    await reviewData.addNote(viewer, s, parsed);
    return { ok: true, notes: await draft(viewer, s) };
  } catch (err) {
    return failure(err);
  }
}

export async function updateNoteAction(src: string, noteId: string, body: string): Promise<NotesResult> {
  const viewer = await requireViewer();
  try {
    const s = source.parse(src);
    await reviewData.updateNote(viewer, z.string().uuid().parse(noteId), z.string().max(2000).parse(body));
    return { ok: true, notes: await draft(viewer, s) };
  } catch (err) {
    return failure(err);
  }
}

export async function deleteNoteAction(src: string, noteId: string): Promise<NotesResult> {
  const viewer = await requireViewer();
  try {
    const s = source.parse(src);
    await reviewData.deleteNote(viewer, z.string().uuid().parse(noteId));
    return { ok: true, notes: await draft(viewer, s) };
  } catch (err) {
    return failure(err);
  }
}

/** A photo or file to go with a note. It also shows under Files, like any upload. */
export async function uploadNoteFileAction(formData: FormData): Promise<ActionResult<{ fileId: string; name: string }>> {
  const viewer = await requireViewer();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose a file to attach." };
  if (file.size > filesData.MAX_UPLOAD_BYTES) return { ok: false, error: "Files can be up to 25 MB." };
  if (viewer.role !== "client" || viewer.previewBy) return { ok: false, error: "This is a preview, so nothing can be changed here." };
  try {
    const name = file.name.slice(0, 255);
    const fileId = await filesData.uploadFile(viewer, { name, mimeType: file.type, data: Buffer.from(await file.arrayBuffer()), needsApproval: false });
    return { ok: true, fileId, name };
  } catch (err) {
    if (err instanceof filesData.StorageFullError) return { ok: false, error: "File storage is full. Send the note without the file and tell us." };
    throw err;
  }
}

export async function submitDraftAction(src: string, input: { title?: string; neededBy?: string }): Promise<ActionResult<{ requestId: string }>> {
  const viewer = await requireViewer();
  try {
    const s = source.parse(src);
    const parsed = z
      .object({ title: z.string().trim().max(200).optional(), neededBy: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("").transform(() => undefined)) })
      .parse(input);
    const requestId = await reviewData.submitDraft(viewer, s, parsed);
    revalidatePath("/", "layout");
    return { ok: true, requestId };
  } catch (err) {
    return failure(err);
  }
}
