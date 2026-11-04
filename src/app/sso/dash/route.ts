import { redirect } from "next/navigation";
import { dashUrl, getViewer } from "@/lib/auth/session";
import { createSsoLink } from "@/lib/data/sso";

// One login: an agency admin signed in here goes on to LMS Dash, already signed in there.
// Dash swaps the token for its own session (redeem_sso_link over MCP). Clients never get one.
export async function GET() {
  const viewer = await getViewer();
  const dash = dashUrl();
  if (!viewer) redirect("/login");
  if (viewer.role !== "agency_admin" || viewer.status !== "active" || !dash) redirect("/");
  const token = await createSsoLink(viewer);
  redirect(`${dash}/sso?t=${token}`);
}
