import { requireClient } from "@/lib/auth/session";
import { payResponse } from "@/lib/pay";

// POST /portal/billing/pay: the Pay and Pay full balance buttons. Makes a Stripe Checkout page for
// the amount the invoices say (never the request) and sends the browser there. src/lib/data/online-pay.ts.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const viewer = await requireClient();
  return payResponse(viewer, await req.formData());
}

export function GET() {
  // A refresh of the redirect lands here; send it back to Billing.
  return new Response(null, { status: 303, headers: { location: "/portal/billing" } });
}
