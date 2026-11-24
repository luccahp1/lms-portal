import { clientViewerOrNull } from "@/lib/auth/session";
import { settledTarget } from "@/lib/data/settled";

// The Invoicing screens call this; it calls the client's Settled business with their owner key
// (docs/settled.md). Only the client's own data is reachable: the key is looked up from the signed-in
// viewer, never taken from the request. /me is Settled's /api/auth/me; everything else is /api/v1/...
// "View as client" can look but not change anything.

export const dynamic = "force-dynamic";

const fail = (status: number, code: string, message: string) => Response.json({ error: { code, message } }, { status });

async function forward(req: Request, ctx: { params: Promise<{ path: string[] }> }): Promise<Response> {
  const viewer = await clientViewerOrNull();
  if (!viewer) return fail(401, "unauthenticated", "Please sign in.");
  if (req.method !== "GET" && viewer.previewBy) return fail(403, "preview", "This is a preview. Nothing here can be changed.");
  if (req.method !== "GET") {
    const origin = req.headers.get("origin");
    if (origin && new URL(origin).host !== new URL(req.url).host && origin !== process.env.APP_URL) return fail(403, "bad_origin", "That request came from another site.");
  }
  const target = await settledTarget(viewer);
  if (!target) return fail(403, "locked", "Invoicing isn't switched on for your account yet.");

  const { path } = await ctx.params;
  if (path.some((p) => p === ".." || p === "." || p.includes("/"))) return fail(400, "bad_path", "That is not a valid address.");
  const upstream = path.length === 1 && path[0] === "me" ? "/api/auth/me" : "/api/v1/" + path.map(encodeURIComponent).join("/");
  const search = new URL(req.url).search;

  let res: Response;
  try {
    res = await fetch(target.base + upstream + search, {
      method: req.method,
      headers: {
        authorization: "Bearer " + target.key,
        accept: req.headers.get("accept") || "application/json",
        ...(req.headers.get("content-type") ? { "content-type": req.headers.get("content-type")! } : {}),
      },
      body: req.method === "GET" || req.method === "HEAD" ? undefined : await req.arrayBuffer(),
      cache: "no-store",
    });
  } catch {
    return fail(502, "settled_down", "Invoicing is taking a short break. Please try again in a minute.");
  }
  const headers = new Headers();
  for (const h of ["content-type", "content-disposition"]) {
    const v = res.headers.get(h);
    if (v) headers.set(h, v);
  }
  headers.set("cache-control", "no-store");
  return new Response(res.body, { status: res.status, headers });
}

export const GET = forward;
export const POST = forward;
export const PATCH = forward;
export const PUT = forward;
export const DELETE = forward;
