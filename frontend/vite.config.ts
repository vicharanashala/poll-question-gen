import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
      "@transcribe/transcriber": resolve(
        __dirname,
        "node_modules/@transcribe/transcriber/src/index.js"
      ),
      "@transcribe/shout": resolve(
        __dirname,
        "node_modules/@transcribe/shout/src/shout/shout.wasm.js"
      )
    }
  },

  optimizeDeps: {
    exclude: ["@transcribe/transcriber", "@transcribe/shout"]
  },

  worker: {
    format: 'es',  // Add this
    plugins: () => []  // Ensure worker uses same plugins
  },

  server: {
    port: 3000,
    headers: {
      "Cross-Origin-Embedder-Policy": "require-corp",
      "Cross-Origin-Opener-Policy": "same-origin",
    },
    fs: {
      allow: [
        ".",  // Allow project root
        "public",
        "node_modules/@transcribe/transcriber",
        "node_modules/@transcribe/shout",
      ]
    }
  }
});