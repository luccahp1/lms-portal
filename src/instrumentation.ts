// Runs once when the server starts. The Node-only part (database, timers) lives in its own
// file so the Edge build never pulls in pg.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./instrumentation-node");
  }
}
