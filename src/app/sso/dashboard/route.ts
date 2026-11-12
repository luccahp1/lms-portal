import { redirect } from "next/navigation";
import { getViewer, requireClient } from "@/lib/auth/session";
import { getClient } from "@/lib/data/clients";
import { dashboardSignInUrl } from "@/lib/data/dashboard-sso";

// "Open your dashboard". A client user goes to their own job dashboard already signed in (a
// one-time token the dashboard swaps for its own session, docs/sso.md). An admin looking through
// View as client, or a client whose dashboard has no sign-in secret yet, gets the plain address.
export async function GET() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  const signIn = await dashboardSignInUrl(viewer);
  if (signIn) redirect(signIn);
  const client = await getClient(await requireClient());
  redirect(client.dashboardUrl ?? "/portal");
}
