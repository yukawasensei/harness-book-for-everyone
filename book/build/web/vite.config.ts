import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  server: {
    host: "127.0.0.1", port: 5173, strictPort: true,
    fs: { strict: true, allow: [fileURLToPath(new URL(".", import.meta.url)), fileURLToPath(new URL("../node_modules", import.meta.url))] },
    proxy: { "/api": { target: "http://127.0.0.1:3001", changeOrigin: true } },
  },
  preview: { host: "127.0.0.1", port: 5173, strictPort: true },
  build: { outDir: "dist" },
});
