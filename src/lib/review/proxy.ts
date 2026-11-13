import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { SANDBOX } from "./sandbox";

// The review frame serves a client's own website through the portal, so the markup script
// can run inside it. This file is everything about fetching and rewriting that site; the
// route (src/app/site/[token]/[[...path]]/route.ts) adds the token check and the headers.
//
// Rules: GET only, only the client's configured host (and its www twin), never a private
// address, bounded size and time. Pages come back with every same-site URL pointing at
// the frame again, and with public/review-agent.js injected first in <head>.

export const AGENT_VERSION = "2";
const MAX_BYTES = 15 * 1024 * 1024;
const TIMEOUT_MS = 15_000;
const MAX_REDIRECTS = 5;

export class ProxyError extends Error {
  constructor(
    message: string,
    public status = 502,
  ) {
    super(message);
  }
}

// ---- which hosts ----

/** example.ca and www.example.ca are the same site. */
export function sameSite(host: string, base: string) {
  const strip = (h: string) => h.toLowerCase().replace(/^www\./, "");
  return strip(host) === strip(base);
}

export function isPrivateAddress(address: string): boolean {
  const kind = isIP(address);
  if (kind === 4) {
    const [a, b] = address.split(".").map(Number) as [number, number];
    return (
      a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224
    );
  }
  if (kind === 6) {
    const v = address.toLowerCase();
    if (v.startsWith("::ffff:")) return isPrivateAddress(v.slice(7));
    return v === "::" || v === "::1" || /^f[cd]/.test(v) || /^fe[89ab]/.test(v);
  }
  return true;
}

/** Refuse a host that is, or resolves to, anything inside our own network. */
export async function assertPublicHost(hostname: string) {
  if (process.env.REVIEW_ALLOW_PRIVATE === "true") return;
  const host = hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => []);
  if (addresses.length === 0) throw new ProxyError("That website's address could not be found.");
  if (addresses.some((a) => isPrivateAddress(a.address))) throw new ProxyError("That address is not a public website.", 403);
}

// ---- fetching ----

export type Upstream = { status: number; contentType: string; body: Uint8Array; finalPath: string; redirected: boolean };

/**
 * GET one path of the client's site. Redirects are followed by hand so they can't leave the
 * site; one that does comes back as a 3xx for the route to pass to the browser untouched.
 */
export async function fetchUpstream(base: URL, pathAndQuery: string, accept?: string | null): Promise<Upstream | { redirect: string }> {
  let url = new URL(pathAndQuery, base.origin);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new ProxyError("Unsupported address.", 400);
    await assertPublicHost(url.hostname);
    let res: Response;
    try {
      res = await fetch(url, {
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { Accept: accept || "*/*", "User-Agent": "LMS-Portal-Review/1.0" },
      });
    } catch {
      throw new ProxyError("The website did not answer.");
    }
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      const next = new URL(res.headers.get("location")!, url);
      if (!sameSite(next.hostname, base.hostname)) return { redirect: next.toString() };
      url = next;
      continue;
    }
    const declared = Number(res.headers.get("content-length") || 0);
    if (declared > MAX_BYTES) throw new ProxyError("That file is too large to preview.", 413);
    const body = new Uint8Array(await res.arrayBuffer());
    if (body.length > MAX_BYTES) throw new ProxyError("That file is too large to preview.", 413);
    return {
      status: res.status,
      contentType: res.headers.get("content-type") || "application/octet-stream",
      body,
      finalPath: url.pathname + url.search,
      redirected: hop > 0,
    };
  }
  throw new ProxyError("The website redirects in a loop.");
}

// ---- rewriting ----

export type Rewrite = {
  /** "/site/<token>", no trailing slash. */
  prefix: string;
  /** The client site's host, e.g. "maplerental.ca". */
  host: string;
};

/**
 * Point one URL back at the frame when it belongs to the client's site. Relative URLs are
 * left alone: the frame's paths mirror the site's, so they already resolve inside it.
 */
export function mapUrl(value: string, rw: Rewrite): string {
  const v = value.trim();
  if (!v || v.startsWith("#") || /^(data|mailto|tel|sms|javascript|blob|about):/i.test(v)) return value;
  if (v.startsWith("//")) {
    const m = /^\/\/([^/?#]+)(.*)$/.exec(v);
    return m && sameSite(m[1]!, rw.host) ? rw.prefix + (m[2]!.startsWith("/") ? m[2] : `/${m[2]}`) : value;
  }
  if (v.startsWith("/")) return v.startsWith(`${rw.prefix}/`) || v === rw.prefix ? value : rw.prefix + v;
  const m = /^https?:\/\/([^/?#]+)(.*)$/i.exec(v);
  if (m && sameSite(m[1]!, rw.host)) return rw.prefix + (m[2]!.startsWith("/") ? m[2] : `/${m[2]}`);
  return value;
}

/** url(...) and @import "..." in a stylesheet or a style attribute. */
export function rewriteCss(css: string, rw: Rewrite): string {
  return css
    .replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (_m, q: string, url: string) => `url(${q}${mapUrl(url, rw)}${q})`)
    .replace(/@import\s+(['"])([^'"]+)\1/gi, (_m, q: string, url: string) => `@import ${q}${mapUrl(url, rw)}${q}`);
}

function mapSrcset(value: string, rw: Rewrite) {
  return value
    .split(",")
    .map((part) => {
      const [url, ...rest] = part.trim().split(/\s+/);
      return url ? [mapUrl(url, rw), ...rest].join(" ") : part;
    })
    .join(", ");
}

const URL_ATTR = /(\s(?:href|src|action|poster|data-src|data-href|formaction)\s*=\s*)(["'])([\s\S]*?)\2/gi;
const SRCSET_ATTR = /(\s(?:srcset|data-srcset|imagesrcset)\s*=\s*)(["'])([\s\S]*?)\2/gi;

/** A page of the client's site, ready for the frame. `agent` is the script tag to inject. */
export function rewriteHtml(html: string, rw: Rewrite, agent: string): string {
  let out = html
    // A CSP or frame rule written into the page would block the markup script.
    .replace(/<meta[^>]+http-equiv\s*=\s*["']?(content-security-policy|x-frame-options)["']?[^>]*>/gi, "")
    // Rewritten files no longer match their integrity hashes.
    .replace(/\s(integrity|nonce)\s*=\s*(["'])[^"']*\2/gi, "")
    .replace(URL_ATTR, (_m, pre: string, q: string, url: string) => `${pre}${q}${mapUrl(url, rw)}${q}`)
    .replace(SRCSET_ATTR, (_m, pre: string, q: string, set: string) => `${pre}${q}${mapSrcset(set, rw)}${q}`);
  out = rewriteCss(out, rw);
  const head = /<head(\s[^>]*)?>/i.exec(out);
  if (head) return out.slice(0, head.index + head[0].length) + agent + out.slice(head.index + head[0].length);
  const doctype = /^\s*<!doctype[^>]*>/i.exec(out);
  const at = doctype ? doctype[0].length : 0;
  return out.slice(0, at) + agent + out.slice(at);
}

/** The injected tag. data-* tell the agent where it is. */
export function agentTag(rw: Rewrite) {
  const attr = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  return `<script src="/review-agent.js?v=${AGENT_VERSION}" data-prefix="${attr(rw.prefix)}" data-host="${attr(rw.host)}"></script>`;
}

/** Sent with everything the frame serves, so none of it can ever act as the portal. */
export function frameHeaders(contentType: string, cache = "private, max-age=120"): Record<string, string> {
  return {
    "Content-Type": contentType,
    "Content-Security-Policy": `sandbox ${SANDBOX}`,
    // A sandboxed page has an origin of its own, so its fonts, modules and fetches of its
    // own files count as cross-origin and need this. The token in the path is the gate.
    "Access-Control-Allow-Origin": "*",
    "Referrer-Policy": "no-referrer",
    "X-Robots-Tag": "noindex, nofollow",
    "Cache-Control": cache,
  };
}

export function isHtml(contentType: string) {
  return /^(text\/html|application\/xhtml\+xml)/i.test(contentType);
}
export function isCss(contentType: string) {
  return /^text\/css/i.test(contentType);
}
