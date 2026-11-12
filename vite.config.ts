import { defineConfig } from "vitest/config";
import { interpretarEmDesenvolvimento } from "./src/servidor/dev";

export default defineConfig({
  plugins: [interpretarEmDesenvolvimento()],
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
