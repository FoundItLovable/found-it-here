import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/app/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    poolOptions: {
      threads: { execArgv: ["--localstorage-file=/dev/null"] },
      forks: { execArgv: ["--localstorage-file=/dev/null"] },
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src/app/") },
  },
});
