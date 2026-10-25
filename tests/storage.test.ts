import { afterEach, describe, expect, it, vi } from "vitest";
import { deleteStoredFile, downloadResponse, readStoredFile, storeFile } from "@/lib/storage";

const A = "11111111-1111-4111-8111-111111111111";
const C = "22222222-2222-4222-8222-222222222222";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("storage keys", () => {
  it("rejects anything that isn't an agency/client/file uuid path", async () => {
    await expect(readStoredFile("../../etc/passwd")).rejects.toThrow("Invalid storage key");
    await expect(deleteStoredFile(`${A}/${C}/../x`)).rejects.toThrow("Invalid storage key");
    await expect(downloadResponse("a/b/c", "x.txt")).rejects.toThrow("Invalid storage key");
  });
});

describe("local disk", () => {
  it("stores, serves as an attachment, and deletes", async () => {
    const key = await storeFile(A, C, Buffer.from("hello"), "text/html");
    expect(key.startsWith(`${A}/${C}/`)).toBe(true);
    const res = await downloadResponse(key, "page <1>.html");
    expect(res.headers.get("content-type")).toBe("application/octet-stream");
    expect(res.headers.get("content-disposition")).toMatch(/^attachment;/);
    expect(await res.text()).toBe("hello");
    await deleteStoredFile(key);
    await expect(readStoredFile(key)).rejects.toThrow();
  });
});

describe("Cloudflare R2", () => {
  function useR2() {
    vi.stubEnv("R2_ACCOUNT_ID", "acct");
    vi.stubEnv("R2_ACCESS_KEY_ID", "key");
    vi.stubEnv("R2_SECRET_ACCESS_KEY", "secret");
    vi.stubEnv("R2_BUCKET", "portal-files");
  }

  it("uploads and deletes with signed requests to the bucket", async () => {
    useR2();
    const calls: Request[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (req: Request) => {
        calls.push(req);
        return new Response(null, { status: 200 });
      }),
    );
    const key = await storeFile(A, C, Buffer.from("data"), "image/png");
    await deleteStoredFile(key);

    expect(calls.map((r) => r.method)).toEqual(["PUT", "DELETE"]);
    expect(calls[0]!.url).toBe(`https://acct.r2.cloudflarestorage.com/portal-files/${key}`);
    expect(calls[0]!.headers.get("authorization")).toMatch(/^AWS4-HMAC-SHA256 Credential=key\//);
    expect(calls[0]!.headers.get("content-type")).toBe("image/png");
  });

  it("fails loudly when the upload is rejected", async () => {
    useR2();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("denied", { status: 403 })));
    await expect(storeFile(A, C, Buffer.from("data"), "image/png")).rejects.toThrow("R2 upload failed: 403");
  });

  it("downloads redirect to a short-lived signed link that forces an attachment", async () => {
    useR2();
    const res = await downloadResponse(`${A}/${C}/33333333-3333-4333-8333-333333333333`, "Design v2.png");
    expect(res.status).toBe(302);
    const url = new URL(res.headers.get("location")!);
    expect(url.host).toBe("acct.r2.cloudflarestorage.com");
    expect(url.searchParams.get("X-Amz-Expires")).toBe("300");
    expect(url.searchParams.get("X-Amz-Signature")).toBeTruthy();
    expect(url.searchParams.get("response-content-disposition")).toMatch(/^attachment; filename="Design v2.png"/);
    expect(url.searchParams.get("response-content-type")).toBe("application/octet-stream");
  });

  it("refuses to run half-configured", async () => {
    vi.stubEnv("R2_BUCKET", "portal-files");
    await expect(storeFile(A, C, Buffer.from("x"), "text/plain")).rejects.toThrow(/R2_ACCOUNT_ID/);
  });
});
