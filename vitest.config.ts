import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    globals: false,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    // Each worker owns a fresh PGlite directory; serial keeps them predictable.
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 60_000,
    pool: "forks",
    clearMocks: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/lib/**", "src/server/**"],
      exclude: ["src/lib/db/schema.ts"],
    },
  },
});
