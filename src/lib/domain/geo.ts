/** Cálculos geográficos locales (sin servicios externos). */

export type LatLng = { lat: number; lng: number };

const EARTH_RADIUS_KM = 6371;

export function haversineKm(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Estimaciones aproximadas de tiempo de traslado a partir de la distancia en línea recta.
 * Se aplica un factor de rodeo porque las calles no van en línea recta. NO son tiempos reales:
 * para rutas exactas se ofrece abrir Google Maps.
 */
export const TRAVEL_MODES = {
  walking: { label: "A pie", speedKmh: 4.8, detour: 1.3, overheadMin: 0 },
  transit: { label: "Transporte público", speedKmh: 18, detour: 1.4, overheadMin: 8 },
  driving: { label: "Coche / taxi", speedKmh: 30, detour: 1.35, overheadMin: 3 },
} as const;

export type TravelMode = keyof typeof TRAVEL_MODES;

export function estimateMinutes(km: number, mode: TravelMode): number {
  const m = TRAVEL_MODES[mode];
  return Math.round(((km * m.detour) / m.speedKmh) * 60 + m.overheadMin);
}

export function formatKm(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1).replace(".", ",")} km`;
  return `${Math.round(km).toLocaleString("es-CL")} km`;
}

export function hasCoords(p: { lat?: number | null; lng?: number | null }): p is LatLng {
  return typeof p.lat === "number" && typeof p.lng === "number" && Number.isFinite(p.lat) && Number.isFinite(p.lng);
}

const GMAPS_MODE: Record<TravelMode, string> = { walking: "walking", transit: "transit", driving: "driving" };

/** URL pública de Google Maps (Maps URLs, no requiere API key) para ver la ruta real. */
export function googleMapsDirectionsUrl(from: LatLng, to: LatLng, mode: TravelMode = "transit"): string {
  const params = new URLSearchParams({
    api: "1",
    origin: `${from.lat},${from.lng}`,
    destination: `${to.lat},${to.lng}`,
    travelmode: GMAPS_MODE[mode],
  });
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export function googleMapsSearchUrl(p: LatLng): string {
  return `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`;
}
