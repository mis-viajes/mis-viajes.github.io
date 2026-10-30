import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Se publica en GitHub Pages (https://diego94diaz-oss.github.io/Travel-manager/). Rutas relativas:
// la app funciona sea cual sea la carpeta (o las mayúsculas) con que se sirva.
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { include: ["src/**/*.test.ts"], environment: "node" },
});
