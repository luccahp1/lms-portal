import { startCheckout } from "@/lib/data/online-pay";
import type { Viewer } from "@/lib/data/viewer";

/**
 * The Pay buttons on Billing are plain form posts (they work with scripts off). This turns one
 * into a 303: to Stripe's page, or back to Billing with ?error=<code>. Relative Location, so it
 * stays on whatever host the client came in on. Kept apart from the route so tests can call it
 * without a session cookie.
 */
export async function payResponse(viewer: Viewer, form: FormData): Promise<Response> {
  const invoice = String(form.get("invoice") ?? "").trim();
  const target = invoice ? { invoice: invoice.slice(0, 50) } : form.get("all") ? { balance: true as const } : null;
  if (!target) return back("failed");
  const started = await startCheckout(viewer, target);
  if (started.ok) return new Response(null, { status: 303, headers: { location: started.url, "cache-control": "no-store" } });
  if (started.error === "notfound") return new Response("Not found", { status: 404 });
  return back(started.error);
}

function back(error: string): Response {
  return new Response(null, { status: 303, headers: { location: "/portal/billing?error=" + error, "cache-control": "no-store" } });
}
