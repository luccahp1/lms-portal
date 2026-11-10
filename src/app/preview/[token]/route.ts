import { redirect } from "next/navigation";
import { startDashPreview } from "@/lib/auth/session";
import { redeemPreviewLink } from "@/lib/data/preview";

// "View as client" from LMS Dash. The link (create_preview_link over MCP) works once, for two
// minutes, and opens a one-hour, read-only preview of that one client's portal.
// ?next= opens a page other than the Overview, e.g. a request's pins in the review tool.
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const session = /^[A-Za-z0-9_-]{20,100}$/.test(token) ? await redeemPreviewLink(token) : null;
  if (!session) return new Response("This preview link has expired. Open View as client again from LMS Dash.", { status: 410 });
  await startDashPreview(session);
  const next = new URL(req.url).searchParams.get("next") ?? "";
  // Only pages a preview can render, and never another site.
  redirect(/^\/(portal|review)(\/|\?|$)/.test(next) && !next.includes("//") && !next.includes("\\") ? next : "/portal");
}
