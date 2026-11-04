import { getPortalViewer } from "@/lib/auth/session";
import { subscribe } from "@/lib/live/hub";

// Server-sent events: one "change" event whenever data the viewer can see changes.
// The page then re-renders itself (router.refresh). A client hears only its own client;
// an admin hears the whole agency. Pages in "View as client" hear that client.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HEARTBEAT_MS = 25_000;
// Collapse bursts (a sync touching many rows) into one refresh.
const DEBOUNCE_MS = 400;

export async function GET(req: Request) {
  const viewer = await getPortalViewer();
  if (!viewer || viewer.status !== "active") return new Response("Unauthorized", { status: 401 });
  const onlyClient = viewer.role === "client" ? viewer.clientId : null;
  const encoder = new TextEncoder();

  let cleanup = () => {};
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let timer: ReturnType<typeof setTimeout> | null = null;
      const send = (text: string) => {
        try {
          controller.enqueue(encoder.encode(text));
        } catch {
          cleanup();
        }
      };
      const unsubscribe = subscribe(viewer.agencyId, (clientId) => {
        if (onlyClient && clientId !== onlyClient) return;
        if (timer) return;
        timer = setTimeout(() => {
          timer = null;
          send(`event: change\ndata: ${JSON.stringify({ clientId })}\n\n`);
        }, DEBOUNCE_MS);
      });
      const beat = setInterval(() => send(": ping\n\n"), HEARTBEAT_MS);
      cleanup = () => {
        unsubscribe();
        clearInterval(beat);
        if (timer) clearTimeout(timer);
        try {
          controller.close();
        } catch {}
      };
      req.signal.addEventListener("abort", () => cleanup());
      // Tell the browser how long to wait before reconnecting, then confirm the stream is open.
      send("retry: 5000\n\n: open\n\n");
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
      // nginx would otherwise buffer the stream.
      "X-Accel-Buffering": "no",
    },
  });
}
