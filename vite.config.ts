import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Se publica en GitHub Pages bajo https://diego94diaz-oss.github.io/travel-manager/
export default defineConfig({
  base: "/travel-manager/",
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { include: ["src/**/*.test.ts"], environment: "node" },
});
