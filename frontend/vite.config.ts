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
    format: 'es',
    rollupOptions: {
      output: {
        inlineDynamicImports: false,
        entryFileNames: 'worker/[name]-[hash].js',
        chunkFileNames: 'worker/[name]-[hash].js',
        assetFileNames: 'worker/[name]-[hash][ext]',

      }
    },
    plugins: () => [comlink()]
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  assetsInclude: ["**/*.wasm", "**/*.ggml", "**/*.bin"],
  optimizeDeps: {
    exclude: ["@transcribe/transcriber", "@transcribe/shout"]
  }
});