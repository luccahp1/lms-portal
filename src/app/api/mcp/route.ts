import { revalidatePath } from "next/cache";
import { viewerFromApiToken } from "@/lib/auth/apiTokens";
import { handleMcpMessage } from "@/lib/mcp/protocol";

// MCP endpoint for Claude. Authenticated with an admin API token:
//   Authorization: Bearer lmsp_...   (npm run api-token -- create <email> <label>)

export const dynamic = "force-dynamic";

function unauthorized() {
  return Response.json(
    { error: "Missing or invalid API token" },
    { status: 401, headers: { "WWW-Authenticate": 'Bearer realm="lms-portal"' } },
  );
}

export async function POST(req: Request) {
  const header = req.headers.get("authorization") ?? "";
  const token = header.match(/^Bearer\s+(\S+)$/i)?.[1];
  const viewer = token ? await viewerFromApiToken(token) : null;
  if (!viewer) return unauthorized();

  let message: unknown;
  try {
    message = await req.json();
  } catch {
    return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, { status: 400 });
  }

  const reply = await handleMcpMessage(viewer, message, () => revalidatePath("/", "layout"));
  if (reply.body === undefined) return new Response(null, { status: reply.status });
  return Response.json(reply.body, { status: reply.status, headers: { "Cache-Control": "no-store" } });
}

// No server-to-client stream and no sessions in this stateless server.
export function GET() {
  return new Response(null, { status: 405, headers: { Allow: "POST" } });
}

export function DELETE() {
  return new Response(null, { status: 405, headers: { Allow: "POST" } });
}
