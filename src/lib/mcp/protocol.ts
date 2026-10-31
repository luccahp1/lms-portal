import { z } from "zod";
import type { Viewer } from "@/lib/data/viewer";
import { tools, type Tool } from "./tools";

// A stateless MCP server over Streamable HTTP: every POST carries one JSON-RPC
// message and gets a plain JSON reply. No sessions, no server-sent events.

const SUPPORTED_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];
const SERVER_INFO = { name: "lms-portal", version: "1.0.0" };

const INSTRUCTIONS =
  "Acts in the London Marketing Solutions client portal as the agency admin who owns the token. " +
  "Call get_overview first to find client ids. To onboard a new client, call new_client_guide and follow it. Messages, comments, files and non-draft invoices are visible to the client, " +
  "so confirm wording with the user before sending.";

type JsonRpcId = string | number | null;
type JsonRpcMessage = { jsonrpc?: string; id?: JsonRpcId; method?: string; params?: Record<string, unknown> };

export type McpReply = { status: number; body?: unknown };

const byName = new Map(tools.map((t) => [t.name, t]));

function toolListing(t: Tool) {
  const inputSchema = z.toJSONSchema(t.input, { io: "input" }) as Record<string, unknown>;
  delete inputSchema.$schema;
  return {
    name: t.name,
    description: t.description,
    inputSchema,
    annotations: { readOnlyHint: Boolean(t.readOnly), destructiveHint: Boolean(t.destructive), openWorldHint: false },
  };
}

const ok = (id: JsonRpcId, result: unknown): McpReply => ({ status: 200, body: { jsonrpc: "2.0", id, result } });
const fail = (id: JsonRpcId, code: number, message: string): McpReply => ({
  status: 200,
  body: { jsonrpc: "2.0", id, error: { code, message } },
});

function errorText(err: unknown): string {
  if (err instanceof z.ZodError) return err.issues.map((i) => `${i.path.join(".") || "input"}: ${i.message}`).join("; ");
  if (err instanceof Error) return err.message;
  return String(err);
}

/** Runs a tool. `onChange` fires after a tool that may have changed data. */
export async function callTool(viewer: Viewer, name: string, args: unknown, onChange?: () => void) {
  const t = byName.get(name);
  if (!t) return { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true };
  try {
    const input = t.input.parse(args ?? {});
    const result = await t.run(viewer, input as never);
    if (!t.readOnly) onChange?.();
    return { content: [{ type: "text", text: JSON.stringify(result ?? null, null, 2) }] };
  } catch (err) {
    return { content: [{ type: "text", text: errorText(err) }], isError: true };
  }
}

export async function handleMcpMessage(viewer: Viewer, message: unknown, onChange?: () => void): Promise<McpReply> {
  if (Array.isArray(message) || typeof message !== "object" || message === null) {
    return fail(null, -32600, "Send one JSON-RPC message per request");
  }
  const { id, method, params } = message as JsonRpcMessage;
  // Notifications (no id) and responses need no reply.
  if (id === undefined) return { status: 202 };
  if (typeof method !== "string") return fail(id, -32600, "Invalid request");

  switch (method) {
    case "initialize": {
      const requested = typeof params?.protocolVersion === "string" ? params.protocolVersion : "";
      return ok(id, {
        protocolVersion: SUPPORTED_VERSIONS.includes(requested) ? requested : SUPPORTED_VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions: INSTRUCTIONS,
      });
    }
    case "ping":
      return ok(id, {});
    case "tools/list":
      return ok(id, { tools: tools.map(toolListing) });
    case "tools/call": {
      if (typeof params?.name !== "string") return fail(id, -32602, "tools/call needs a tool name");
      return ok(id, await callTool(viewer, params.name, params.arguments, onChange));
    }
    default:
      return fail(id, -32601, `Method not found: ${method}`);
  }
}
