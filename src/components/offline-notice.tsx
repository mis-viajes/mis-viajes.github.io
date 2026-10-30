import { WifiOff } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";
import { notifyDataChanged } from "@/lib/hooks";
import { getUsingCopy, subscribeUsingCopy } from "@/lib/offline";

/** Avisa de que se está viendo la copia local y vuelve a leer al recuperar la conexión. */
export function OfflineNotice() {
  const usingCopy = useSyncExternalStore(subscribeUsingCopy, getUsingCopy);
  useEffect(() => {
    window.addEventListener("online", notifyDataChanged);
    return () => window.removeEventListener("online", notifyDataChanged);
  }, []);
  if (!usingCopy) return null;
  return (
    <p className="flex items-center gap-2 bg-warning-soft px-4 py-2 text-sm text-warning print:hidden" role="status">
      <WifiOff size={15} className="shrink-0" />
      Sin conexión: ves la última copia guardada en este dispositivo. Los cambios no se pueden guardar.
    </p>
  );
}
