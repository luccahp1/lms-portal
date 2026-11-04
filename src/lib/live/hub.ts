import { Client } from "pg";

// One LISTEN connection per server process. Postgres triggers (drizzle/0004_live_notify.sql)
// send NOTIFY portal_changes '<agency>:<client>' on every client-visible change, whoever made
// it (a page, the MCP endpoint, LMS Dash, the hourly stats refresh). Open pages subscribe
// through /api/live and get a tiny "changed" event instead of polling the database.

type Listener = (clientId: string) => void;
type Hub = {
  listeners: Map<string, Set<Listener>>;
  client: Client | null;
  starting: Promise<void> | null;
  /** Close functions of the open /api/live streams. */
  streams: Set<() => void>;
};

const g = globalThis as unknown as { liveHub?: Hub };
const hub: Hub = (g.liveHub ??= { listeners: new Map(), client: null, starting: null, streams: new Set() });

/** Register an open stream so shutdown can end it. Returns the matching unregister. */
export function trackStream(close: () => void): () => void {
  hub.streams.add(close);
  return () => hub.streams.delete(close);
}

/**
 * End every open stream. On SIGTERM Next stops accepting connections and waits for the open
 * ones to finish, and an SSE stream never finishes by itself, so without this a restart hung
 * until systemd killed the process (90 s with the portal unreachable). Browsers reconnect to
 * the new process on their own (retry: 5000).
 */
export function closeAllStreams() {
  for (const close of [...hub.streams]) close();
}

function dispatch(payload: string) {
  const [agencyId, clientId = ""] = payload.split(":");
  if (!agencyId) return;
  for (const fn of hub.listeners.get(agencyId) ?? []) fn(clientId);
}

async function connect() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  client.on("notification", (msg) => msg.payload && dispatch(msg.payload));
  const reconnect = () => {
    if (hub.client !== client) return;
    hub.client = null;
    client.removeAllListeners();
    client.end().catch(() => {});
    // Pages fall back to their slow poll meanwhile; try again shortly.
    setTimeout(() => void ensureListening(), 5000);
  };
  client.on("error", reconnect);
  client.on("end", reconnect);
  await client.connect();
  await client.query("LISTEN portal_changes");
  hub.client = client;
}

export function ensureListening(): Promise<void> {
  if (hub.client) return Promise.resolve();
  hub.starting ??= connect()
    .catch((err) => {
      console.error("live updates: LISTEN failed", err instanceof Error ? err.message : err);
      setTimeout(() => void ensureListening(), 10_000);
    })
    .finally(() => {
      hub.starting = null;
    });
  return hub.starting;
}

/** Call `fn` with the client id whenever something in this agency changes. Returns unsubscribe. */
export function subscribe(agencyId: string, fn: Listener): () => void {
  void ensureListening();
  let set = hub.listeners.get(agencyId);
  if (!set) hub.listeners.set(agencyId, (set = new Set()));
  set.add(fn);
  return () => {
    set!.delete(fn);
    if (set!.size === 0) hub.listeners.delete(agencyId);
  };
}

export function listenerCount() {
  let n = 0;
  for (const s of hub.listeners.values()) n += s.size;
  return n;
}
