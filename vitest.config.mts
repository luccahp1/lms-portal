import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: {
    globalSetup: ["./tests/global-setup.ts"],
    env: {
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? "postgres://lms_portal:devpass@127.0.0.1:5432/lms_portal_test",
      FILE_STORAGE_DIR: path.resolve(import.meta.dirname, ".test-uploads"),
    },
    // Tests share one database; run files one at a time.
    fileParallelism: false,
  },
});
