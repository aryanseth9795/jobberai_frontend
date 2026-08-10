import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const here = import.meta.dirname;

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.test.{ts,tsx}"],
    exclude: ["node_modules/**", ".next/**"],
  },
  resolve: {
    alias: { "@": path.resolve(here, ".") },
  },
});
