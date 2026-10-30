import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { fetchAllBundles, fetchExchangeRates, fetchTripBundle, fetchTrips, latestRates } from "./data";

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
    fnRef.current().then(
      (data) => !cancelled && setState({ key: requestKey, data, error: null }),
      (error) => !cancelled && setState((s) => ({ key: requestKey, data: s.key?.startsWith(`${key}#`) ? s.data : undefined, error })),
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
