import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

// Uploaded files live on local disk under FILE_STORAGE_DIR/<agency>/<client>/<uuid>.
// The key stored in the DB is the relative path; it is never built from user input.

function root() {
  return path.resolve(process.env.FILE_STORAGE_DIR || "./uploads");
}

function resolveKey(key: string) {
  const full = path.resolve(root(), key);
  if (!full.startsWith(root() + path.sep)) throw new Error("Invalid storage key");
  return full;
}

export async function storeFile(agencyId: string, clientId: string, data: Buffer): Promise<string> {
  const key = path.join(agencyId, clientId, randomUUID());
  const full = resolveKey(key);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, data, { mode: 0o600 });
  return key;
}

export async function readStoredFile(key: string): Promise<Buffer> {
  return readFile(resolveKey(key));
}

export async function deleteStoredFile(key: string): Promise<void> {
  await rm(resolveKey(key), { force: true });
}
