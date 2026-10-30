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

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
