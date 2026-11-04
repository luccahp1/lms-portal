import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { pool?: Pool };

function createPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  // Small pool: the home server has 8 GB RAM shared with other apps.
  // Idle connections stay open for 10 minutes (pg's default is 10 s). Opening one costs about
  // 20 ms (TCP + SCRAM auth), and on a quiet site most page views come more than 10 s apart.
  const pool = new Pool({ connectionString, max: 5, idleTimeoutMillis: 10 * 60 * 1000 });
  // An idle connection that Postgres drops (restart, admin kill) emits here; without a
  // listener that error would crash the process. The pool discards the client on its own.
  pool.on("error", (err) => console.error("idle postgres connection error", err.message));
  return pool;
}

// Reuse the pool across hot reloads in dev.
const pool = globalForDb.pool ?? createPool();
if (process.env.NODE_ENV !== "production") globalForDb.pool = pool;

export const db = drizzle(pool, { schema });
export type DB = typeof db;
export { pool };
