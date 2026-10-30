import { dateRange, daysUntil, formatDuration, localToInstant, minutesBetween } from "./dates";
import { overnightTransitNights } from "./itinerary";
import { findConnections, flightSegment, transportSegment } from "./segments";
import type { TripBundle } from "./types";

export type AlertLevel = "danger" | "warning" | "info";

export type Alert = {
  id: string;
  level: AlertLevel;
  title: string;
  detail?: string;
  section: "flights" | "lodging" | "transport" | "activities" | "finance" | "overview";
};

const ACTIVE = (s: string) => s !== "cancelado";

/** Genera las alertas de un viaje a partir de sus datos. `now` se inyecta para poder testear. */
export function computeAlerts(b: TripBundle, now: Date, today: string): Alert[] {
  const alerts: Alert[] = [];
  const finished = today > b.trip.endDate || b.trip.status === "cancelado";

  // Vuelos próximos (48 h) y vuelos sin equipaje registrado.
  for (const f of b.flights.filter((f) => ACTIVE(f.bookingStatus))) {
    const label = [f.airline, f.flightNumber].filter(Boolean).join(" ") || "Vuelo";
    const route = [f.originCode ?? f.originName, f.destinationCode ?? f.destinationName].filter(Boolean).join(" → ");
    const dep = localToInstant(f.departureLocal, f.departureTz);
    if (dep) {
      const minutes = minutesBetween(now, dep.date);
      if (minutes > 0 && minutes <= 48 * 60) {
        alerts.push({
          id: `flight-soon-${f.id}`,
          level: "warning",
          title: `${label} sale en ${formatDuration(minutes)}`,
          detail: `${route}. Revisa el check-in en la web o app de la aerolínea.`,
          section: "flights",
        });
      }
    }
    if (!finished && f.baggage.length === 0) {
      alerts.push({
        id: `flight-nobag-${f.id}`,
        level: "warning",
        title: `${label}: sin información de equipaje`,
        detail: route ? `${route}. Registra la franquicia de equipaje de este vuelo.` : undefined,
        section: "flights",
      });
    }
    if (f.bookingStatus === "idea" || f.bookingStatus === "estimado") {
      alerts.push({
        id: `flight-unbooked-${f.id}`,
        level: "info",
        title: `${label}: vuelo aún no reservado`,
        detail: route || undefined,
        section: "flights",
      });
    }
  }

  // Conexiones ajustadas o solapadas entre vuelos y transportes.
  const segments = [
    ...b.flights.map(flightSegment),
    ...b.transports.map(transportSegment),
  ];
  for (const c of findConnections(segments)) {
    if (!c.tight) continue;
    alerts.push({
      id: `conn-${c.from.id}-${c.to.id}`,
      level: c.overlap ? "danger" : "warning",
      title: c.overlap
        ? `Horarios solapados: ${c.from.label} y ${c.to.label}`
        : `Conexión ajustada: ${formatDuration(c.gapMinutes)} entre ${c.from.label} y ${c.to.label}`,
      detail: c.overlap
        ? "El segundo tramo sale antes de que llegue el primero."
        : `Se recomiendan al menos ${formatDuration(c.minimum)}.${c.from.exact ? "" : " (Falta la zona horaria de algún tramo: el cálculo es aproximado.)"}`,
      section: c.to.kind === "flight" ? "flights" : "transport",
    });
  }

  // Check-in / check-out de hoy y mañana.
  for (const l of b.lodgings.filter((l) => ACTIVE(l.bookingStatus))) {
    for (const [date, kind] of [
      [l.checkInDate, "Check-in"],
      [l.checkOutDate, "Check-out"],
    ] as const) {
      if (!date) continue;
      const d = daysUntil(date, today);
      if (d === 0 || d === 1) {
        const time = kind === "Check-in" ? l.checkInTime : l.checkOutTime;
        alerts.push({
          id: `lodging-${kind}-${l.id}`,
          level: "info",
          title: `${kind} ${d === 0 ? "hoy" : "mañana"}: ${l.name}`,
          detail: time ? `Hora: ${time}` : undefined,
          section: "lodging",
        });
      }
    }
  }

  // Noches del viaje sin alojamiento registrado.
  if (!finished) {
    const nights = dateRange(b.trip.startDate, b.trip.endDate).slice(0, -1);
    const inTransit = overnightTransitNights(b);
    const uncovered = nights.filter(
      (n) =>
        !inTransit.has(n) &&
        !b.lodgings.some(
          (l) => ACTIVE(l.bookingStatus) && l.checkInDate && l.checkOutDate && l.checkInDate <= n && n < l.checkOutDate,
        ),
    );
    if (uncovered.length > 0 && nights.length > 0) {
      alerts.push({
        id: "lodging-gaps",
        level: "warning",
        title: `${uncovered.length} ${uncovered.length === 1 ? "noche" : "noches"} sin alojamiento registrado`,
        detail: summarizeDates(uncovered),
        section: "lodging",
      });
    }
  }

  // Actividades que requieren reserva y aún no están reservadas.
  for (const a of b.activities) {
    if (a.requiresBooking && (a.bookingStatus === "idea" || a.bookingStatus === "estimado")) {
      alerts.push({
        id: `activity-book-${a.id}`,
        level: "warning",
        title: `Reserva pendiente: ${a.name}`,
        detail: a.date ? `Programada para el ${a.date}` : "Requiere reserva previa.",
        section: "activities",
      });
    }
  }

  // Actividades con horarios superpuestos.
  for (const [x, y] of overlappingActivities(b)) {
    alerts.push({
      id: `activity-overlap-${x.id}-${y.id}`,
      level: "warning",
      title: `Actividades superpuestas: ${x.name} y ${y.name}`,
      detail: `${x.date} · ${x.startTime}–${x.endTime ?? "?"} / ${y.startTime}–${y.endTime ?? "?"}`,
      section: "activities",
    });
  }

  // Pagos pendientes.
  const pending = b.expenses.filter((e) => e.status === "pendiente" || e.status === "parcial");
  if (pending.length > 0) {
    alerts.push({
      id: "finance-pending",
      level: "warning",
      title: `${pending.length} ${pending.length === 1 ? "pago pendiente" : "pagos pendientes"}`,
      detail: pending
        .slice(0, 3)
        .map((e) => e.description)
        .join(", ") + (pending.length > 3 ? "…" : ""),
      section: "finance",
    });
  }

  // Reservas con precio que todavía no tienen un gasto asociado.
  const linked = new Set(b.expenses.map((e) => `${e.sourceType}:${e.sourceId}`));
  const unlinked = [
    ...b.flights.map((x) => ["flight", x] as const),
    ...b.lodgings.map((x) => ["lodging", x] as const),
    ...b.transports.map((x) => ["transport", x] as const),
    ...b.activities.map((x) => ["activity", x] as const),
  ].filter(([type, x]) => x.priceMinor && ACTIVE(x.bookingStatus) && !linked.has(`${type}:${x.id}`));
  if (unlinked.length > 0) {
    alerts.push({
      id: "finance-unlinked",
      level: "info",
      title: `${unlinked.length} ${unlinked.length === 1 ? "reserva con precio" : "reservas con precio"} sin gasto registrado`,
      detail: "Regístralas en Finanzas para que el presupuesto sea completo.",
      section: "finance",
    });
  }

  const order: Record<AlertLevel, number> = { danger: 0, warning: 1, info: 2 };
  return alerts.sort((a, b) => order[a.level] - order[b.level]);
}

function toMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

export function overlappingActivities(b: Pick<TripBundle, "activities">) {
  const timed = b.activities.filter((a) => a.date && a.startTime && a.bookingStatus !== "cancelado");
  const pairs: [(typeof timed)[number], (typeof timed)[number]][] = [];
  for (let i = 0; i < timed.length; i++) {
    for (let j = i + 1; j < timed.length; j++) {
      const x = timed[i];
      const y = timed[j];
      if (x.date !== y.date) continue;
      const xs = toMinutes(x.startTime!);
      const ys = toMinutes(y.startTime!);
      // Sin hora de término, se asume que la actividad dura al menos 1 hora.
      const xe = x.endTime ? toMinutes(x.endTime) : xs + 60;
      const ye = y.endTime ? toMinutes(y.endTime) : ys + 60;
      if (xs < ye && ys < xe) pairs.push([x, y]);
    }
  }
  return pairs;
}

function summarizeDates(dates: string[]): string {
  const shown = dates.slice(0, 4).map((d) => d.slice(5).split("-").reverse().join("/"));
  return `Noches del ${shown.join(", ")}${dates.length > 4 ? "…" : ""}`;
}
