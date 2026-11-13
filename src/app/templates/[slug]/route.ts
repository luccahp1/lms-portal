import { findTemplate, renderTemplate } from "@/lib/templates";

// One of the ten site designs as a full page, with a business's name, phone and town filled
// in from the query string (?name=&phone=&city=). Public: prospects open these before they
// have a login. Values are escaped in renderTemplate.
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const template = findTemplate(slug);
  if (!template) return new Response("Not found", { status: 404 });
  const q = new URL(req.url).searchParams;
  const html = renderTemplate(template, { business: q.get("name"), phone: q.get("phone"), city: q.get("city") });
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "X-Robots-Tag": "noindex, nofollow",
      // Only our own pages may frame a design (the gallery does).
      "Content-Security-Policy": "frame-ancestors 'self'",
      "Cache-Control": "public, max-age=300",
    },
  });
}
