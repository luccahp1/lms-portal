import { cache } from "react";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { files, users, type FileApproval } from "@/db/schema";
import { assertAdmin, NotFoundError, resolveClientId, type Viewer } from "./viewer";
import { deleteStoredFile, storeFile } from "@/lib/storage";
import { notifyDashActivity } from "@/lib/webhook";

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

// Every agency shares one R2 bucket. Uploads stop before it leaves R2's free 10 GB;
// raise STORAGE_LIMIT_BYTES once paid storage is fine.
const DEFAULT_STORAGE_LIMIT_BYTES = 8 * 1024 ** 3;

export class StorageFullError extends Error {
  constructor() {
    super("File storage is full");
  }
}

function storageLimitBytes() {
  return Number(process.env.STORAGE_LIMIT_BYTES) || DEFAULT_STORAGE_LIMIT_BYTES;
}

async function storedBytes() {
  const [row] = await db.select({ total: sql<string>`coalesce(sum(${files.sizeBytes}), 0)` }).from(files);
  return Number(row.total);
}

export const FOLDERS = ["", "brand"] as const;
export type Folder = (typeof FOLDERS)[number];

/** A client's files. `folder` narrows to one folder; omitted lists everything. */
export const listFiles = cache(async function listFiles(viewer: Viewer, clientId?: string, folder?: Folder) {
  const id = await resolveClientId(viewer, clientId);
  return db
    .select({
      id: files.id,
      name: files.name,
      mimeType: files.mimeType,
      sizeBytes: files.sizeBytes,
      approval: files.approval,
      folder: files.folder,
      createdAt: files.createdAt,
      uploadedByName: users.name,
      uploadedByRole: users.role,
    })
    .from(files)
    .leftJoin(users, eq(users.id, files.uploadedById))
    .where(folder === undefined ? eq(files.clientId, id) : and(eq(files.clientId, id), eq(files.folder, folder)))
    .orderBy(desc(files.createdAt));
});

/** Raster images are safe to show inline (no scripts, unlike SVG or HTML). */
export function isInlineImage(mimeType: string) {
  return /^image\/(png|jpeg|webp|gif)$/.test(mimeType);
}

export async function getFile(viewer: Viewer, fileId: string) {
  const [row] = await db
    .select()
    .from(files)
    .where(and(eq(files.id, fileId), eq(files.agencyId, viewer.agencyId)));
  if (!row) throw new NotFoundError();
  if (viewer.role === "client" && row.clientId !== viewer.clientId) throw new NotFoundError();
  return row;
}

export async function uploadFile(
  viewer: Viewer,
  input: { name: string; mimeType: string; data: Buffer; needsApproval: boolean; folder?: Folder },
  clientId?: string,
) {
  // Only the agency files things into the brand kit.
  const folder: Folder = viewer.role === "agency_admin" ? (input.folder ?? "") : "";
  const id = await resolveClientId(viewer, clientId);
  if (input.data.length === 0) throw new Error("Empty file");
  if (input.data.length > MAX_UPLOAD_BYTES) throw new Error("File is too large");
  if ((await storedBytes()) + input.data.length > storageLimitBytes()) throw new StorageFullError();
  // Only the agency can ask the client to approve something.
  const approval: FileApproval = viewer.role === "agency_admin" && input.needsApproval ? "pending" : "none";
  const storageKey = await storeFile(viewer.agencyId, id, input.data, input.mimeType);
  let fileId: string;
  try {
    const [row] = await db.insert(files).values({
      agencyId: viewer.agencyId,
      clientId: id,
      uploadedById: viewer.userId,
      name: input.name,
      storageKey,
      mimeType: input.mimeType || "application/octet-stream",
      sizeBytes: input.data.length,
      folder,
      approval,
    }).returning({ id: files.id });
    fileId = row!.id;
  } catch (err) {
    await deleteStoredFile(storageKey);
    throw err;
  }
  if (viewer.role === "client") notifyDashActivity("file.uploaded", id, { name: input.name });
  return fileId;
}

/** Client response to a file the agency marked as needing approval. */
export async function respondToFile(viewer: Viewer, fileId: string, decision: "approved" | "changes_requested") {
  const file = await getFile(viewer, fileId);
  if (viewer.role !== "client" || file.approval !== "pending") throw new NotFoundError();
  await db.update(files).set({ approval: decision }).where(eq(files.id, file.id));
  notifyDashActivity("file.responded", file.clientId, { name: file.name, decision });
}

export async function deleteFile(viewer: Viewer, fileId: string) {
  assertAdmin(viewer);
  const file = await getFile(viewer, fileId);
  await db.delete(files).where(eq(files.id, file.id));
  await deleteStoredFile(file.storageKey);
}
