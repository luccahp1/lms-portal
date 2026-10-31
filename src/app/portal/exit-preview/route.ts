import { redirect } from "next/navigation";
import { endPreview } from "@/lib/auth/session";

// Leaves "View as client" and goes back to that client's admin page.
export async function GET() {
  const clientId = await endPreview();
  redirect(clientId && /^[0-9a-f-]{36}$/i.test(clientId) ? `/admin/clients/${clientId}` : "/admin");
}
