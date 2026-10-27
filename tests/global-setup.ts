import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

// Bring the test database up to the latest migration before any test runs.
export default async function setup() {
  const url = process.env.TEST_DATABASE_URL ?? "postgres://lms_portal:devpass@127.0.0.1:5432/lms_portal_test";
  const pool = new Pool({ connectionString: url });
  await migrate(drizzle(pool), { migrationsFolder: "./drizzle" });
  await pool.end();
}
