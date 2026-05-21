import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

const packageRoot = new URL(".", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

export default defineConfig({
  root: packageRoot,
  cacheDir: ".vite-cache",
  plugins: [vue()],
  server: {
    port: 5173
  },
  build: {
    outDir: "dist"
  }
});
