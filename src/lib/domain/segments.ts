import type { Flight, Transport } from "../types";
import { localToInstant, minutesBetween } from "./dates";

/** Tramo de desplazamiento (vuelo o transporte terrestre) normalizado a instantes UTC. */
export type Segment = {
  kind: "flight" | "transport";
  id: string;
  label: string;
  from: string | null;
  to: string | null;
  departure: Date | null;
  arrival: Date | null;
  exact: boolean;
  cancelled: boolean;
};

export function flightSegment(f: Flight): Segment {
  const dep = localToInstant(f.departureLocal, f.departureTz);
  const arr = localToInstant(f.arrivalLocal, f.arrivalTz);
  return {
    kind: "flight",
    id: f.id,
    label: [f.airline, f.flightNumber].filter(Boolean).join(" ") || "Vuelo",
    from: f.originCode ?? f.originName,
    to: f.destinationCode ?? f.destinationName,
    departure: dep?.date ?? null,
    arrival: arr?.date ?? null,
    exact: Boolean(dep?.exact && arr?.exact),
    cancelled: f.bookingStatus === "cancelado",
  };
}

export function transportSegment(t: Transport): Segment {
  const dep = localToInstant(t.departureLocal, t.timezone);
  const arr = localToInstant(t.arrivalLocal, t.timezone);
  return {
    kind: "transport",
    id: t.id,
    label: [t.operator, t.serviceNumber].filter(Boolean).join(" ") || t.type,
    from: t.origin,
    to: t.destination,
    departure: dep?.date ?? null,
    arrival: arr?.date ?? null,
    exact: Boolean(dep?.exact),
    cancelled: t.bookingStatus === "cancelado",
  };
}

export function segmentDuration(s: Segment): number | null {
  return s.departure && s.arrival ? minutesBetween(s.departure, s.arrival) : null;
}

/**
 * Tiempo mínimo recomendado entre dos tramos consecutivos (minutos). Heurística configurable:
 * - vuelo → vuelo: 60 (conexión en el mismo aeropuerto)
 * - vuelo → terrestre: 75 (desembarque, equipaje y salida del aeropuerto)
 * - terrestre → vuelo: 120 (llegada anticipada recomendada al aeropuerto)
 * - terrestre → terrestre: 20
 */
export const MIN_CONNECTION_MINUTES = {
  "flight>flight": 60,
  "flight>transport": 75,
  "transport>flight": 120,
  "transport>transport": 20,
} as const;

/** Huecos mayores que esto no se consideran conexión. */
const MAX_CONNECTION_WINDOW_MIN = 8 * 60;

export type Connection = {
  from: Segment;
  to: Segment;
  gapMinutes: number;
  minimum: number;
  tight: boolean;
  overlap: boolean;
};

export function findConnections(segments: Segment[]): Connection[] {
  const sorted = segments
    .filter((s) => !s.cancelled && s.departure)
    .sort((a, b) => a.departure!.getTime() - b.departure!.getTime());
  const result: Connection[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (!a.arrival || !b.departure) continue;
    const gap = minutesBetween(a.arrival, b.departure);
    if (gap > MAX_CONNECTION_WINDOW_MIN) continue;
    const minimum = MIN_CONNECTION_MINUTES[`${a.kind}>${b.kind}`];
    result.push({ from: a, to: b, gapMinutes: gap, minimum, tight: gap < minimum, overlap: gap < 0 });
  }
  return result;
}
