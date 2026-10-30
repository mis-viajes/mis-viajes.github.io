import { useTrip } from "@/pages/trip/context";
import { BedDouble, Map as MapIcon } from "lucide-react";
import { updateCoordinates } from "@/lib/api";
import { Geocoder } from "@/components/map/geocoder";
import { MapLoader } from "@/components/map/map-loader";
import { Card, EmptyState, PageHeader, SectionTitle } from "@/components/ui";
import { formatDuration } from "@/lib/domain/dates";
import { estimateMinutes, formatKm, hasCoords, haversineKm } from "@/lib/domain/geo";
import { collectMapData } from "@/lib/domain/map-points";

export default function MapPage() {
  const { b, tripId } = useTrip();
  const { points, lines } = collectMapData(b);
  const located = points.filter((p) => p.lat !== null && p.lng !== null);
  const missing = points.filter((p) => (p.lat === null || p.lng === null) && p.query.trim());

  // Desde cada alojamiento: aeropuertos, estaciones, actividades y restaurantes cercanos.
  const fromLodgings = b.lodgings
    .filter((l) => hasCoords(l) && l.bookingStatus !== "cancelado")
    .map((l) => ({
      lodging: l,
      near: located
        .filter((p) => p.kind !== "destination" && p.kind !== "lodging")
        .map((p) => ({ p, km: haversineKm({ lat: l.lat!, lng: l.lng! }, { lat: p.lat!, lng: p.lng! }) }))
        .filter((x) => x.km < 40)
        .sort((a, b2) => a.km - b2.km)
        .slice(0, 10),
    }))
    .filter((x) => x.near.length > 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Mapa del viaje" subtitle="Destinos, alojamientos, aeropuertos, estaciones, actividades y restaurantes en un solo mapa." />
      {points.length === 0 ? (
        <EmptyState icon={<MapIcon size={32} />} title="Nada que mostrar todavía">
          Añade destinos, alojamientos, vuelos o actividades. Después podrás ubicarlos automáticamente en el mapa.
        </EmptyState>
      ) : (
        <>
          {located.length > 0 ? (
            <MapLoader points={points} lines={lines} destinations={b.destinations.map((d) => ({ id: d.id, city: d.city, lat: d.lat, lng: d.lng }))} />
          ) : (
            <Card className="p-4 text-sm text-muted">Ningún lugar tiene coordenadas todavía. Usa el buscador de abajo para ubicarlos.</Card>
          )}
          {missing.length > 0 && <Geocoder key={missing.map((m) => m.key).join()} missing={missing} save={updateCoordinates.bind(null, tripId)} />}
          {fromLodgings.length > 0 && (
            <section>
              <SectionTitle title="Distancias desde tus alojamientos" subtitle="Línea recta y tiempo estimado a pie o en transporte público." />
              <div className="grid gap-3 md:grid-cols-2">
                {fromLodgings.map(({ lodging, near }) => (
                  <Card key={lodging.id} className="p-4">
                    <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
                      <BedDouble size={15} /> {lodging.name}
                    </p>
                    <ul className="space-y-1 text-sm">
                      {near.map(({ p, km }) => (
                        <li key={p.key} className="flex justify-between gap-2">
                          <span className="min-w-0 truncate">{p.label}</span>
                          <span className="shrink-0 tabular-nums text-muted">
                            {formatKm(km)} · {km < 2.5 ? `${formatDuration(estimateMinutes(km, "walking"))} a pie` : `~${formatDuration(estimateMinutes(km, "transit"))} en transporte`}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </Card>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
