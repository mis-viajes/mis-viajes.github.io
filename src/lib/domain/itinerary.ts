import type { Activity, Destination, Lodging, Restaurant, Transport } from "../types";
import { datePart, dateRange } from "./dates";
import type { FlightWithBaggage, TripBundle } from "./types";

export type DayPlan = {
  date: string;
  dayNumber: number;
  destinations: Destination[];
  /** Alojamiento donde se duerme esa noche. */
  lodging: Lodging | null;
  /** La noche se pasa viajando (vuelo o trayecto nocturno). */
  overnightTransit: boolean;
  checkIns: Lodging[];
  checkOuts: Lodging[];
  flights: FlightWithBaggage[];
  transports: Transport[];
  activities: Activity[];
  restaurants: Restaurant[];
};

const active = (s: string) => s !== "cancelado";

/** Por hora; las actividades sin hora van al final, en el orden manual del usuario. */
export function compareActivities(x: Activity, y: Activity): number {
  return (x.startTime ?? "99").localeCompare(y.startTime ?? "99") || (x.position ?? 0) - (y.position ?? 0);
}

/** Responde "dónde estaré, cómo llegaré, dónde dormiré y qué haré" para cada día del viaje. */
export function buildItinerary(b: TripBundle): DayPlan[] {
  const days = dateRange(b.trip.startDate, b.trip.endDate);
  const transitNights = overnightTransitNights(b);
  return days.map((date, i) => {
    const lodgings = b.lodgings.filter((l) => active(l.bookingStatus));
    return {
      date,
      dayNumber: i + 1,
      destinations: b.destinations.filter((d) => isInDestination(d, date)),
      lodging: lodgings.find((l) => l.checkInDate && l.checkOutDate && l.checkInDate <= date && date < l.checkOutDate) ?? null,
      overnightTransit: transitNights.has(date),
      checkIns: lodgings.filter((l) => l.checkInDate === date),
      checkOuts: lodgings.filter((l) => l.checkOutDate === date),
      flights: b.flights
        .filter((f) => datePart(f.departureLocal) === date)
        .sort((x, y) => (x.departureLocal ?? "").localeCompare(y.departureLocal ?? "")),
      transports: b.transports
        .filter((t) => datePart(t.departureLocal) === date)
        .sort((x, y) => (x.departureLocal ?? "").localeCompare(y.departureLocal ?? "")),
      activities: b.activities
        .filter((a) => a.date === date)
        .sort(compareActivities),
      restaurants: b.restaurants.filter((r) => datePart(r.reservedAt) === date),
    };
  });
}

/** Sugiere el destino de una reserva por ciudad y fechas (el usuario decide si lo acepta). */
export function suggestDestination(
  destinations: Destination[],
  city: string | null | undefined,
  date: string | null | undefined,
): Destination | null {
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  if (city) {
    const byCity = destinations.filter((d) => norm(d.city) === norm(city));
    if (byCity.length === 1) return byCity[0];
    if (byCity.length > 1 && date) {
      return byCity.find((d) => (!d.arrivalDate || d.arrivalDate <= date) && (!d.departureDate || date <= d.departureDate)) ?? byCity[0];
    }
  }
  if (date) {
    const byDate = destinations.filter(
      (d) => d.arrivalDate && d.departureDate && d.arrivalDate <= date && date < d.departureDate,
    );
    if (byDate.length === 1) return byDate[0];
  }
  return null;
}

/** Noches (fecha de inicio de la noche) que se pasan en un vuelo o trayecto nocturno. */
export function overnightTransitNights(b: Pick<TripBundle, "flights" | "transports">): Set<string> {
  const nights = new Set<string>();
  const legs = [
    ...b.flights.map((f) => [f.departureLocal, f.arrivalLocal, f.bookingStatus] as const),
    ...b.transports.map((t) => [t.departureLocal, t.arrivalLocal, t.bookingStatus] as const),
  ];
  for (const [dep, arr, status] of legs) {
    const from = datePart(dep);
    const to = datePart(arr);
    if (!from || !to || status === "cancelado" || to <= from) continue;
    for (const d of dateRange(from, to).slice(0, -1)) nights.add(d);
  }
  return nights;
}

/**
 * Si el destino tiene llegada y salida, cuenta todo el intervalo. Si solo se conoce una de
 * las dos fechas, cuenta únicamente ese día: no se supone cuánto tiempo se pasa allí.
 */
export function isInDestination(d: Pick<Destination, "arrivalDate" | "departureDate">, date: string): boolean {
  if (d.arrivalDate && d.departureDate) return d.arrivalDate <= date && date <= d.departureDate;
  return d.arrivalDate === date || d.departureDate === date;
}
