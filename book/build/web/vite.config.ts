import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const root = fileURLToPath(new URL(".", import.meta.url));
const srcDir = path.resolve(root, "src");
const packageRoot = path.resolve(root, "..");

export default defineConfig({
  root,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": srcDir,
      "@server": path.resolve(packageRoot, "src/server"),
      "@contracts": path.resolve(packageRoot, "src/contracts"),
      "@workflow": path.resolve(packageRoot, "src/workflow"),
      "@project": path.resolve(packageRoot, "src/project"),
    },
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    fs: {
      strict: true,
      allow: [root, path.resolve(packageRoot, "node_modules"), path.resolve(packageRoot, "src")],
    },
    proxy: { "/api": { target: "http://127.0.0.1:3001", changeOrigin: true } },
  },
  preview: { host: "127.0.0.1", port: 5173, strictPort: true },
  build: { outDir: "dist" },
});
