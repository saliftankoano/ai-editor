import { defineConfig } from "vite";

export default defineConfig({
  define: {
    "process.env": process.env,
  },
  base: "./",
  envDir: "./",
  server: {
    port: 3000,
    open: true,
  },
  build: {
    outDir: "dist",
    assetsDir: "assets",
    sourcemap: false,
  },
  optimizeDeps: {
    exclude: ["monaco-editor"],
  },
  resolve: {
    alias: [
      {
        find: /^.*\/min-maps\/vs/,
        replacement: "/vendor/monaco-editor-0.44.0/min-maps/vs",
      },
    ],
  },
  css: {
    devSourcemap: false,
  },
});
