import { useSyncExternalStore } from "react";

/** Evento de Chrome, Edge y Android que permite mostrar el diálogo de instalación propio. */
type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

let promptEvent: InstallPrompt | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

// Se escucha desde el arranque: el navegador lo dispara una sola vez, antes de pintar la app.
export function listenForInstallPrompt() {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    promptEvent = e as InstallPrompt;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    promptEvent = null;
    emit();
  });
}

export const isInstalled = () =>
  matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

/** true cuando el navegador permite instalar con un clic. */
export function useCanInstall() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => promptEvent !== null,
  );
}

export async function promptInstall() {
  if (!promptEvent) return;
  await promptEvent.prompt();
  await promptEvent.userChoice;
  promptEvent = null;
  emit();
}
