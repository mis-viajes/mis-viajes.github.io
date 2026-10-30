import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { fetchAllBundles, fetchExchangeRates, fetchTripBundle, fetchTrips, latestRates } from "./data";
import { isNetworkError, readCached, setUsingCopy, writeCached } from "./offline";

// Cada mutación incrementa la versión; las vistas suscritas vuelven a leer los datos.
let version = 0;
const listeners = new Set<() => void>();

export function notifyDataChanged() {
  version++;
  listeners.forEach((l) => l());
}

function useDataVersion() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => version,
  );
}

export type AsyncState<T> = { data: T | undefined; loading: boolean; error: unknown };

/**
 * Carga datos y los vuelve a leer tras cada mutación. Mientras recarga, conserva los datos
 * anteriores de la misma consulta para que la pantalla no parpadee.
 */
function useAsync<T>(fn: () => Promise<T>, key: string): AsyncState<T> {
  const requestKey = `${key}#${useDataVersion()}`;
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  });
  const [state, setState] = useState<{ key: string | null; data?: T; error: unknown }>({ key: null, error: null });
  useEffect(() => {
    let cancelled = false;
    let fresh = false;
    // La copia local se pinta al instante; con mala señal la pantalla no queda en blanco.
    readCached<T>(key).then((copy) => {
      if (copy === undefined || cancelled || fresh) return;
      setState((s) => (s.key?.startsWith(`${key}#`) ? s : { key: `${key}#copia`, data: copy, error: null }));
    });
    // Sin red no se intenta: con el token vencido, supabase-js tardaría unos 30 s en rendirse.
    (navigator.onLine ? fnRef.current() : Promise.reject(new Error("Failed to fetch"))).then(
      (data) => {
        fresh = true;
        setUsingCopy(false);
        void writeCached(key, data);
        if (!cancelled) setState({ key: requestKey, data, error: null });
      },
      async (error) => {
        const copy = isNetworkError(error) ? await readCached<T>(key) : undefined;
        if (copy !== undefined) setUsingCopy(true);
        if (cancelled) return;
        if (copy !== undefined) setState({ key: requestKey, data: copy, error: null });
        else setState((s) => ({ key: requestKey, data: s.key?.startsWith(`${key}#`) ? s.data : undefined, error }));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [requestKey, key]);
  const sameQuery = state.key?.startsWith(`${key}#`) ?? false;
  return { data: sameQuery ? state.data : undefined, loading: state.key !== requestKey, error: sameQuery ? state.error : null };
}

export const useTripBundle = (tripId: string) => useAsync(() => fetchTripBundle(tripId), `bundle:${tripId}`);
export const useAllBundles = () => useAsync(fetchAllBundles, "bundles");
export const useTrips = () => useAsync(fetchTrips, "trips");
export const useExchangeRates = () => useAsync(fetchExchangeRates, "rates");

export function useLatestRates() {
  const { data } = useExchangeRates();
  return data ? latestRates(data) : {};
}
