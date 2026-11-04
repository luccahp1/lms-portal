import { redirect } from "next/navigation";
import { endSession } from "@/lib/auth/session";

// Signing out of LMS Dash ends the portal session too: Dash sends the browser here.
export async function GET() {
  await endSession();
  redirect("/login");
}
