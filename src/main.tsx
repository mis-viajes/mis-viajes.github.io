import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { listenForInstallPrompt } from "./lib/install";

listenForInstallPrompt();

// Tras publicar una versión nueva, una pestaña antigua puede pedir archivos que ya no existen.
window.addEventListener("vite:preloadError", () => {
  if (navigator.onLine && !sessionStorage.getItem("tm-reloaded")) {
    sessionStorage.setItem("tm-reloaded", "1");
    location.reload();
  }
});

// Al abrir la app, el service worker sirve la versión guardada y descarga la nueva en segundo
// plano. Si llega en los primeros segundos se aplica de inmediato: aún no hay nada a medio escribir.
if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (performance.now() < 15000) location.reload();
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
