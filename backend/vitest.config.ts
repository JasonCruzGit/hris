import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
    env: {
      VITEST: "true",
      JWT_SECRET: "test-jwt-secret-for-ci",
    },
  },
});
