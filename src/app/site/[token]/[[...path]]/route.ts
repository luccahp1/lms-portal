import { reviewTarget } from "@/lib/data/review";
import { agentTag, fetchUpstream, frameHeaders, isCss, isHtml, ProxyError, rewriteCss, rewriteHtml, type Rewrite } from "@/lib/review/proxy";
import { verifyReviewToken } from "@/lib/review/token";
import { findTemplate, renderTemplate } from "@/lib/templates";

// The review frame: a client's own website (or the design they picked) served through the
// portal with the markup script injected. See src/lib/review/proxy.ts and docs/website-changes.md.
// Only GET and HEAD exist here, so a form inside the frame can't send anything.

export const dynamic = "force-dynamic";

type Target = NonNullable<Awaited<ReturnType<typeof reviewTarget>>>;
// A page of a client's site pulls dozens of files; look the client up once for all of them.
// Only a usable site address is remembered, and briefly, so a new preview address or a
// design picked a moment ago shows up straight away.
const cache = new Map<string, { at: number; target: Target }>();
const CACHE_MS = 15_000;

async function target(clientId: string, source: "site" | "template") {
  if (source === "template") return reviewTarget(clientId);
  const hit = cache.get(clientId);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.target;
  const found = await reviewTarget(clientId);
  if (found?.siteUrl) {
    cache.set(clientId, { at: Date.now(), target: found });
    if (cache.size > 500) cache.delete(cache.keys().next().value!);
  }
  return found;
}

function message(text: string, status: number) {
  const page = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Preview</title><body style="font:16px/1.5 system-ui,sans-serif;color:#0E120F;background:#F6F8F6;display:grid;place-items:center;min-height:90vh;margin:0;padding:24px;text-align:center"><p style="max-width:34ch">${text}</p>`;
  return new Response(page, { status, headers: frameHeaders("text/html; charset=utf-8", "no-store") });
}

export async function GET(req: Request, { params }: { params: Promise<{ token: string; path?: string[] }> }) {
  const { token } = await params;
  const claim = verifyReviewToken(token);
  if (!claim) return message("This preview has timed out. Go back to your portal and open it again.", 401);
  const found = await target(claim.clientId, claim.source);
  if (!found) return message("This preview is no longer available.", 404);

  const here = new URL(req.url);
  const prefix = `/site/${token}`;
  // The path as the browser sent it, so encoded characters reach the site unchanged.
  const rest = here.pathname.slice(prefix.length) || "/";

  if (claim.source === "template") {
    const template = findTemplate(found.templateSlug);
    if (!template) return message("No design has been picked yet.", 404);
    if (rest !== "/") return message("This design is a single page.", 404);
    const html = renderTemplate(template, { business: found.name, phone: found.phone });
    return new Response(rewriteHtml(html, { prefix, host: "design.invalid" }, agentTag({ prefix, host: "design.invalid" })), {
      headers: frameHeaders("text/html; charset=utf-8", "no-store"),
    });
  }

  if (!found.siteUrl) return message("There is no website to show here yet. We will let you know when yours is ready to look at.", 404);
  let base: URL;
  try {
    base = new URL(found.siteUrl);
  } catch {
    return message("This website's address is not set up correctly. Please tell us.", 502);
  }
  const rw: Rewrite = { prefix, host: base.hostname };
  // Opening the frame's root goes to the address we were given (which may be a sub-page).
  const path = rest === "/" && base.pathname !== "/" && !here.search ? base.pathname + base.search : rest + here.search;
  try {
    const got = await fetchUpstream(base, path, req.headers.get("accept"));
    if ("redirect" in got) return new Response(null, { status: 302, headers: { Location: got.redirect, ...frameHeaders("text/plain", "no-store") } });
    // The site sent us somewhere else inside itself (/services to /services/): send the
    // browser there too, so the page's relative links resolve the way they do on the site.
    if (got.redirected && got.finalPath !== path) return new Response(null, { status: 302, headers: { Location: prefix + got.finalPath, ...frameHeaders("text/plain", "no-store") } });
    if (isHtml(got.contentType)) {
      const html = new TextDecoder().decode(got.body);
      return new Response(rewriteHtml(html, rw, agentTag(rw)), { status: got.status, headers: frameHeaders("text/html; charset=utf-8", "no-store") });
    }
    if (isCss(got.contentType)) {
      return new Response(rewriteCss(new TextDecoder().decode(got.body), rw), { status: got.status, headers: frameHeaders(got.contentType) });
    }
    return new Response(got.body as BodyInit, { status: got.status, headers: frameHeaders(got.contentType) });
  } catch (err) {
    if (err instanceof ProxyError) return message(err.message, err.status);
    throw err;
  }
}

export async function HEAD(req: Request, ctx: { params: Promise<{ token: string; path?: string[] }> }) {
  const res = await GET(req, ctx);
  return new Response(null, { status: res.status, headers: res.headers });
}
