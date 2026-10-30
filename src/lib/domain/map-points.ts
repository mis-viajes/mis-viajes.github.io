import { hasCoords } from "./geo";
import type { TripBundle } from "./types";

export type PointKind = "destination" | "lodging" | "airport" | "station" | "activity" | "restaurant";

export type CoordRef = {
  entity: "destination" | "lodging" | "activity" | "restaurant" | "flight" | "transport";
  id: string;
  latName: string;
  lngName: string;
};

export type MapPoint = {
  key: string;
  kind: PointKind;
  label: string;
  sub: string | null;
  lat: number | null;
  lng: number | null;
  /** Texto para buscar la ubicación si faltan coordenadas. */
  query: string;
  /** Registros que comparten esta ubicación (p. ej. un aeropuerto usado por varios vuelos). */
  refs: CoordRef[];
  destinationId: string | null;
};

export type MapLine = { key: string; kind: "route" | "flight" | "transport"; from: [number, number]; to: [number, number]; label: string };

export const POINT_LABELS: Record<PointKind, string> = {
  destination: "Destinos",
  lodging: "Alojamientos",
  airport: "Aeropuertos",
  station: "Estaciones y paradas",
  activity: "Actividades",
  restaurant: "Restaurantes",
};

/** Reúne todos los lugares del viaje con o sin coordenadas. */
export function collectMapData(b: TripBundle): { points: MapPoint[]; lines: MapLine[] } {
  const points: MapPoint[] = [];
  const active = (s: string) => s !== "cancelado";

  for (const d of b.destinations) {
    points.push({
      key: `destination:${d.id}`,
      kind: "destination",
      label: d.city,
      sub: d.country,
      lat: d.lat,
      lng: d.lng,
      query: [d.city, d.country].filter(Boolean).join(", "),
      refs: [{ entity: "destination", id: d.id, latName: "lat", lngName: "lng" }],
      destinationId: d.id,
    });
  }
  for (const l of b.lodgings.filter((x) => active(x.bookingStatus))) {
    points.push({
      key: `lodging:${l.id}`,
      kind: "lodging",
      label: l.name,
      sub: [l.address, l.city].filter(Boolean).join(", ") || null,
      lat: l.lat,
      lng: l.lng,
      query: [l.address, l.city, l.country].filter(Boolean).join(", ") || l.name,
      refs: [{ entity: "lodging", id: l.id, latName: "lat", lngName: "lng" }],
      destinationId: l.destinationId,
    });
  }
  for (const a of b.activities.filter((x) => active(x.bookingStatus))) {
    points.push({
      key: `activity:${a.id}`,
      kind: "activity",
      label: a.name,
      sub: [a.date, a.startTime].filter(Boolean).join(" ") || a.city,
      lat: a.lat,
      lng: a.lng,
      query: [a.name, a.address, a.city].filter(Boolean).join(", "),
      refs: [{ entity: "activity", id: a.id, latName: "lat", lngName: "lng" }],
      destinationId: a.destinationId,
    });
  }
  for (const r of b.restaurants) {
    points.push({
      key: `restaurant:${r.id}`,
      kind: "restaurant",
      label: r.name,
      sub: [r.cuisine, r.city].filter(Boolean).join(" · ") || null,
      lat: r.lat,
      lng: r.lng,
      query: [r.name, r.address, r.city].filter(Boolean).join(", "),
      refs: [{ entity: "restaurant", id: r.id, latName: "lat", lngName: "lng" }],
      destinationId: r.destinationId,
    });
  }

  // Aeropuertos y estaciones: se agrupan los extremos que comparten nombre/código.
  const ends = new Map<string, MapPoint>();
  const addEnd = (
    kind: "airport" | "station",
    name: string | null,
    code: string | null,
    lat: number | null,
    lng: number | null,
    ref: CoordRef,
    query: string,
  ) => {
    const label = code && name ? `${name} (${code})` : (name ?? code);
    if (!label) return;
    const key = `${kind}:${(code ?? name)!.toLowerCase()}`;
    const existing = ends.get(key);
    if (existing) {
      existing.refs.push(ref);
      if (existing.lat === null && lat !== null) Object.assign(existing, { lat, lng });
      return;
    }
    ends.set(key, { key, kind, label, sub: null, lat, lng, query, refs: [ref], destinationId: null });
  };
  for (const f of b.flights.filter((x) => active(x.bookingStatus))) {
    addEnd("airport", f.originName, f.originCode, f.originLat, f.originLng, { entity: "flight", id: f.id, latName: "originLat", lngName: "originLng" }, f.originName ?? `${f.originCode} airport`);
    addEnd("airport", f.destinationName, f.destinationCode, f.destinationLat, f.destinationLng, { entity: "flight", id: f.id, latName: "destinationLat", lngName: "destinationLng" }, f.destinationName ?? `${f.destinationCode} airport`);
  }
  for (const t of b.transports.filter((x) => active(x.bookingStatus))) {
    addEnd("station", t.origin, null, t.originLat, t.originLng, { entity: "transport", id: t.id, latName: "originLat", lngName: "originLng" }, t.origin ?? "");
    addEnd("station", t.destination, null, t.destinationLat, t.destinationLng, { entity: "transport", id: t.id, latName: "destinationLat", lngName: "destinationLng" }, t.destination ?? "");
  }
  points.push(...ends.values());

  const lines: MapLine[] = [];
  const located = b.destinations.filter(hasCoords);
  for (let i = 0; i < located.length - 1; i++) {
    lines.push({ key: `route:${i}`, kind: "route", from: [located[i].lat!, located[i].lng!], to: [located[i + 1].lat!, located[i + 1].lng!], label: `${located[i].city} → ${located[i + 1].city}` });
  }
  for (const f of b.flights.filter((x) => active(x.bookingStatus))) {
    if (f.originLat !== null && f.originLng !== null && f.destinationLat !== null && f.destinationLng !== null) {
      lines.push({ key: `flight:${f.id}`, kind: "flight", from: [f.originLat, f.originLng], to: [f.destinationLat, f.destinationLng], label: [f.airline, f.flightNumber].filter(Boolean).join(" ") || "Vuelo" });
    }
  }
  for (const t of b.transports.filter((x) => active(x.bookingStatus))) {
    if (t.originLat !== null && t.originLng !== null && t.destinationLat !== null && t.destinationLng !== null) {
      lines.push({ key: `transport:${t.id}`, kind: "transport", from: [t.originLat, t.originLng], to: [t.destinationLat, t.destinationLng], label: [t.operator, t.serviceNumber].filter(Boolean).join(" ") || t.type });
    }
  }
  return { points, lines };
}
