import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { AwsClient } from "aws4fetch";

// Uploaded files. Two backends, picked by environment:
//  - Cloudflare R2 when R2_BUCKET is set (production: files live off the home server)
//  - local disk under FILE_STORAGE_DIR otherwise (development and tests)
// Keys are always <agency uuid>/<client uuid>/<file uuid>, generated here, never from user input.

const KEY_PATTERN = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9a-f-]{36}$/;
const DOWNLOAD_LINK_SECONDS = 300;

function checkKey(key: string) {
  if (!KEY_PATTERN.test(key)) throw new Error("Invalid storage key");
}

type R2Config = { client: AwsClient; base: string };

function r2(): R2Config | null {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env;
  if (!R2_BUCKET) return null;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    throw new Error("R2_BUCKET is set but R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY are missing");
  }
  return {
    client: new AwsClient({ accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY, service: "s3", region: "auto" }),
    base: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}`,
  };
}

function diskPath(key: string) {
  checkKey(key);
  const root = path.resolve(process.env.FILE_STORAGE_DIR || "./uploads");
  return path.join(root, ...key.split("/"));
}

export async function storeFile(agencyId: string, clientId: string, data: Buffer, mimeType: string): Promise<string> {
  const key = `${agencyId}/${clientId}/${randomUUID()}`;
  checkKey(key);
  const remote = r2();
  if (remote) {
    const res = await remote.client.fetch(`${remote.base}/${key}`, {
      method: "PUT",
      body: new Uint8Array(data),
      headers: { "Content-Type": mimeType || "application/octet-stream" },
    });
    if (!res.ok) throw new Error(`R2 upload failed: ${res.status}`);
    return key;
  }
  const full = diskPath(key);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, data, { mode: 0o600 });
  return key;
}

export async function deleteStoredFile(key: string): Promise<void> {
  checkKey(key);
  const remote = r2();
  if (remote) {
    const res = await remote.client.fetch(`${remote.base}/${key}`, { method: "DELETE" });
    if (!res.ok && res.status !== 404) throw new Error(`R2 delete failed: ${res.status}`);
    return;
  }
  await rm(diskPath(key), { force: true });
}

/** Local disk only. */
export async function readStoredFile(key: string): Promise<Buffer> {
  return readFile(diskPath(key));
}

function contentDisposition(filename: string) {
  const ascii = filename.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

/**
 * The response for an authorised download. With R2 this is a redirect to a
 * short-lived signed URL, so the bytes come from Cloudflare, not the home
 * server's upload bandwidth. Always forces a download (never renders inline).
 */
export async function downloadResponse(key: string, filename: string): Promise<Response> {
  checkKey(key);
  const remote = r2();
  if (remote) {
    const url = new URL(`${remote.base}/${key}`);
    url.searchParams.set("X-Amz-Expires", String(DOWNLOAD_LINK_SECONDS));
    url.searchParams.set("response-content-disposition", contentDisposition(filename));
    url.searchParams.set("response-content-type", "application/octet-stream");
    const signed = await remote.client.sign(url.toString(), { method: "GET", aws: { signQuery: true } });
    return new Response(null, { status: 302, headers: { Location: signed.url, "Cache-Control": "private, no-store" } });
  }
  const data = await readStoredFile(key);
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Length": String(data.length),
      "Content-Disposition": contentDisposition(filename),
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
