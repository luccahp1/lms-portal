import { redirect } from "next/navigation";
import { endDashPreview, endPreview } from "@/lib/auth/session";

// Leaves "View as client" and goes back to that client's admin page (or LMS Dash).
export async function GET() {
  if (await endDashPreview()) redirect(process.env.ADMIN_HOME_URL || "/login");
  const clientId = await endPreview();
  redirect(clientId && /^[0-9a-f-]{36}$/i.test(clientId) ? `/admin/clients/${clientId}` : "/admin");
}
