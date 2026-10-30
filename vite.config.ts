import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { defineConfig } from "vitest/config";

// Se publica en GitHub Pages (https://diego94diaz-oss.github.io/Travel-manager/). Rutas relativas:
// la app funciona sea cual sea la carpeta (o las mayúsculas) con que se sirva.
export default defineConfig({
  base: "./",
  plugins: [
    react(),
    tailwindcss(),
    // App instalable y sin conexión. Los datos del viaje se guardan aparte (src/lib/offline.ts).
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "script",
      includeAssets: ["favicon.svg", "icons/apple-touch-icon.png"],
      manifest: {
        id: "./",
        name: "Travel Manager",
        short_name: "Viajes",
        description: "Planifica y gestiona todos tus viajes en un solo lugar.",
        lang: "es",
        start_url: "./",
        scope: "./",
        display: "standalone",
        background_color: "#f6f7f9",
        theme_color: "#0f766e",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,webmanifest}"],
        navigateFallback: "index.html",
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
    }),
  ],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { include: ["src/**/*.test.ts"], environment: "node" },
});
