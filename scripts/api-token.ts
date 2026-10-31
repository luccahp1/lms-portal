// Manage API tokens for the MCP endpoint (/api/mcp). Admins only.
//
//   npm run api-token -- create you@example.com "Claude Code"   prints the token once
//   npm run api-token -- list you@example.com
//   npm run api-token -- revoke you@example.com ["Claude Code"]  omit the label to revoke all

import { eq } from "drizzle-orm";
import { db, pool } from "@/db";
import { users } from "@/db/schema";
import { createApiToken, listApiTokens, revokeApiTokens } from "@/lib/auth/apiTokens";

async function main() {
  const [command, email, label] = process.argv.slice(2);
  if (!command || !email) throw new Error("Usage: api-token <create|list|revoke> <email> [label]");
  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, email.toLowerCase()));
  if (!user) throw new Error(`No user with email ${email}`);

  if (command === "create") {
    if (!label) throw new Error("Give the token a label, e.g. \"Claude Code\"");
    const token = await createApiToken(user.id, label);
    console.log(`Token for ${email} (${label}). Shown once, store it now:`);
    console.log(token);
    console.log(`MCP URL: ${process.env.APP_URL || "http://localhost:3000"}/api/mcp`);
  } else if (command === "list") {
    console.table(await listApiTokens(user.id));
  } else if (command === "revoke") {
    console.log(`Revoked ${await revokeApiTokens(user.id, label)} token(s)`);
  } else {
    throw new Error(`Unknown command ${command}`);
  }
}

main()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
