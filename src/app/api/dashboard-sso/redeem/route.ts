import { redeemDashboardSsoLink } from "@/lib/data/dashboard-sso";

// Called by a client's job dashboard, server to server, to swap a sign-in token for who it
// belongs to. The dashboard proves which client it is with its own secret (Authorization:
// Bearer). One answer for every failure, so a caller learns nothing about which part was wrong.
export async function POST(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const secret = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  let token = "";
  try {
    const body = (await req.json()) as { token?: unknown };
    token = typeof body.token === "string" ? body.token : "";
  } catch {
    token = "";
  }
  const who = await redeemDashboardSsoLink(secret, token);
  if (!who) return Response.json({ error: "invalid" }, { status: 401, headers: { "cache-control": "no-store" } });
  return Response.json(who, { headers: { "cache-control": "no-store" } });
}
