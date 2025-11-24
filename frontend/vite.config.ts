import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { comlink } from "vite-plugin-comlink";

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    port: 3000,
  },
  worker: {
    plugins: () => [comlink()]
  },
  plugins: [react()],
  assetsInclude: ["**/*.ggml", "**/*.bin", "**/*.wasm"],
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
});