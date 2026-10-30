import { lazy, Suspense, type ComponentProps } from "react";

// Leaflet pesa bastante: el mapa se carga solo al abrir la pestaña.
const TripMap = lazy(() => import("./trip-map"));

export function MapLoader(props: ComponentProps<typeof TripMap>) {
  return (
    <Suspense fallback={<div className="grid h-[60vh] min-h-[22rem] place-items-center rounded-xl border border-line bg-surface-2 text-sm text-muted">Cargando mapa…</div>}>
      <TripMap {...props} />
    </Suspense>
  );
}
