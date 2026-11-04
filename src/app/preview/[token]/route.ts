import { redirect } from "next/navigation";
import { startDashPreview } from "@/lib/auth/session";
import { redeemPreviewLink } from "@/lib/data/preview";

// "View as client" from LMS Dash. The link (create_preview_link over MCP) works once, for two
// minutes, and opens a one-hour, read-only preview of that one client's portal.
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const session = /^[A-Za-z0-9_-]{20,100}$/.test(token) ? await redeemPreviewLink(token) : null;
  if (!session) return new Response("This preview link has expired. Open View as client again from LMS Dash.", { status: 410 });
  await startDashPreview(session);
  redirect("/portal");
}
