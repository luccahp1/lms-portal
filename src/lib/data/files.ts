import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { files, users, type FileApproval } from "@/db/schema";
import { assertAdmin, NotFoundError, resolveClientId, type Viewer } from "./viewer";
import { deleteStoredFile, storeFile } from "@/lib/storage";

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export async function listFiles(viewer: Viewer, clientId?: string) {
  const id = await resolveClientId(viewer, clientId);
  return db
    .select({
      id: files.id,
      name: files.name,
      mimeType: files.mimeType,
      sizeBytes: files.sizeBytes,
      approval: files.approval,
      createdAt: files.createdAt,
      uploadedByName: users.name,
      uploadedByRole: users.role,
    })
    .from(files)
    .leftJoin(users, eq(users.id, files.uploadedById))
    .where(eq(files.clientId, id))
    .orderBy(desc(files.createdAt));
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
  input: { name: string; mimeType: string; data: Buffer; needsApproval: boolean },
  clientId?: string,
) {
  const id = await resolveClientId(viewer, clientId);
  if (input.data.length === 0) throw new Error("Empty file");
  if (input.data.length > MAX_UPLOAD_BYTES) throw new Error("File is too large");
  // Only the agency can ask the client to approve something.
  const approval: FileApproval = viewer.role === "agency_admin" && input.needsApproval ? "pending" : "none";
  const storageKey = await storeFile(viewer.agencyId, id, input.data, input.mimeType);
  try {
    await db.insert(files).values({
      agencyId: viewer.agencyId,
      clientId: id,
      uploadedById: viewer.userId,
      name: input.name,
      storageKey,
      mimeType: input.mimeType || "application/octet-stream",
      sizeBytes: input.data.length,
      approval,
    });
  } catch (err) {
    await deleteStoredFile(storageKey);
    throw err;
  }
}

/** Client response to a file the agency marked as needing approval. */
export async function respondToFile(viewer: Viewer, fileId: string, decision: "approved" | "changes_requested") {
  const file = await getFile(viewer, fileId);
  if (viewer.role !== "client" || file.approval !== "pending") throw new NotFoundError();
  await db.update(files).set({ approval: decision }).where(eq(files.id, file.id));
}

export async function deleteFile(viewer: Viewer, fileId: string) {
  assertAdmin(viewer);
  const file = await getFile(viewer, fileId);
  await db.delete(files).where(eq(files.id, file.id));
  await deleteStoredFile(file.storageKey);
}
