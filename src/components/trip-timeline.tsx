import { CircleCheck } from "lucide-react";
import { Link } from "react-router";
import { formatDate, formatDuration, localToInstant, minutesBetween, nightsBetween, timePart } from "@/lib/domain/dates";
import type { DayPlan } from "@/lib/domain/itinerary";
import { formatMoney } from "@/lib/domain/money";
import { BOOKING_STATUS, TRANSPORT_TYPE } from "@/lib/labels";
import { KindIcon, type Kind } from "./kind-icon";
import { Badge, BOOKING_TONE, cx } from "./ui";

type Event = { key: string; kind: Kind; time: string | null; title: string; detail?: string; status?: string; href: string };

function eventsOf(day: DayPlan, tripId: string, base: string): Event[] {
  const t = (p: string) => `/trips/${tripId}/${p}`;
  const list: Event[] = [
    ...day.checkOuts.map((l) => ({ key: `out-${l.id}`, kind: "checkout" as const, time: l.checkOutTime, title: `Check-out · ${l.name}`, href: t("lodging") })),
    ...day.flights.map((f) => {
      const dep = localToInstant(f.departureLocal, f.departureTz);
      const arr = localToInstant(f.arrivalLocal, f.arrivalTz);
      const dur = dep && arr && dep.exact && arr.exact ? formatDuration(minutesBetween(dep.date, arr.date)) : null;
      return {
        key: f.id,
        kind: "flight" as const,
        time: timePart(f.departureLocal),
        title: `${f.originCode ?? f.originName ?? "?"} → ${f.destinationCode ?? f.destinationName ?? "?"}`,
        detail: [[f.airline, f.flightNumber].filter(Boolean).join(" "), f.arrivalLocal && `llega ${timePart(f.arrivalLocal)}`, dur].filter(Boolean).join(" · "),
        status: f.bookingStatus,
        href: t("flights"),
      };
    }),
    ...day.transports.map((x) => ({
      key: x.id,
      kind: "transport" as const,
      time: timePart(x.departureLocal),
      title: `${x.origin ?? "?"} → ${x.destination ?? "?"}`,
      detail: [TRANSPORT_TYPE[x.type], x.operator, x.arrivalLocal && `llega ${timePart(x.arrivalLocal)}`].filter(Boolean).join(" · "),
      status: x.bookingStatus,
      href: t("transport"),
    })),
    ...day.checkIns.map((l) => {
      const n = nightsBetween(l.checkInDate, l.checkOutDate);
      return {
        key: `in-${l.id}`,
        kind: "checkin" as const,
        time: l.checkInTime,
        title: `Check-in · ${l.name}`,
        detail: [l.city, n !== null && `${n} ${n === 1 ? "noche" : "noches"}`].filter(Boolean).join(" · "),
        status: l.bookingStatus,
        href: t("lodging"),
      };
    }),
    ...day.activities.map((a) => ({
      key: a.id,
      kind: "activity" as const,
      time: a.startTime,
      title: a.name,
      detail: [a.endTime && `hasta ${a.endTime}`, a.priceMinor !== null && formatMoney(a.priceMinor, a.currency ?? base)].filter(Boolean).join(" · "),
      status: a.requiresBooking ? a.bookingStatus : undefined,
      href: t("activities"),
    })),
    ...day.restaurants.map((r) => ({ key: r.id, kind: "restaurant" as const, time: timePart(r.reservedAt), title: r.name, detail: "Reserva", href: t("restaurants") })),
  ];
  return list.sort((a, b) => (a.time ?? "99").localeCompare(b.time ?? "99"));
}

type Block = { kind: "day"; day: DayPlan; events: Event[] } | { kind: "quiet"; days: DayPlan[] };

/** Agrupa días seguidos sin planes en un solo bloque para que la línea no se alargue de más. */
function blocks(days: DayPlan[], tripId: string, base: string): Block[] {
  const out: Block[] = [];
  for (const day of days) {
    const events = eventsOf(day, tripId, base);
    const quiet = events.length === 0 && !day.overnightTransit;
    const last = out[out.length - 1];
    const sameStay = last?.kind === "quiet" && last.days[0].lodging?.id === day.lodging?.id && last.days[0].destinations[0]?.id === day.destinations[0]?.id;
    if (quiet && sameStay) last.days.push(day);
    else if (quiet) out.push({ kind: "quiet", days: [day] });
    else out.push({ kind: "day", day, events });
  }
  return out;
}

function DayLabel({ date, today }: { date: string; today: string }) {
  return (
    <div className={cx("w-14 shrink-0 rounded-lg py-1 text-center", date === today ? "bg-accent text-accent-ink" : "bg-surface-2")}>
      <p className="text-lg font-bold leading-none">{formatDate(date, "d")}</p>
      <p className="text-[10px] font-medium uppercase tracking-wide opacity-80">{formatDate(date, "MMM")}</p>
    </div>
  );
}

/** Línea de tiempo vertical del viaje: qué pasa cada día y dónde se duerme. */
export function TripTimeline({ days, tripId, base, today }: { days: DayPlan[]; tripId: string; base: string; today: string }) {
  return (
    <ol className="relative space-y-1">
      {blocks(days, tripId, base).map((block) => {
        if (block.kind === "quiet") {
          const first = block.days[0];
          const last = block.days[block.days.length - 1];
          const where = first.lodging?.name ?? first.destinations.map((d) => d.city).join(" · ");
          return (
            <li key={first.date} className="flex gap-3 py-2">
              <DayLabel date={first.date} today={today} />
              <div className="min-w-0 flex-1 border-l-2 border-dashed border-line pl-4">
                <p className="text-sm text-muted">
                  {block.days.length > 1 ? `${formatDate(first.date, "d MMM")} – ${formatDate(last.date, "d MMM")} · ` : ""}
                  Sin planes registrados{where ? ` · ${where}` : ""}
                </p>
                {!first.lodging && first.dayNumber < days.length && <p className="text-xs text-warning">Sin alojamiento registrado</p>}
              </div>
            </li>
          );
        }
        const { day, events } = block;
        return (
          <li key={day.date} className="flex gap-3 py-2">
            <DayLabel date={day.date} today={today} />
            <div className="min-w-0 flex-1">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold capitalize">{formatDate(day.date, "EEEE")}</span>
                <span className="text-xs text-muted">Día {day.dayNumber}</span>
                {day.destinations.map((d) => (
                  <Badge key={d.id} tone="accent">
                    {d.city}
                  </Badge>
                ))}
              </div>
              <ul className="relative space-y-2 border-l-2 border-line pl-6">
                {events.map((e) => (
                  <li key={e.key} className="relative">
                    <span className="absolute -left-[42px] top-0.5">
                      <KindIcon kind={e.kind} size="sm" />
                    </span>
                    <Link to={e.href} className="block rounded-lg border border-line bg-surface px-3 py-2 transition hover:border-accent/40 hover:shadow-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        {e.time && <span className="text-sm font-semibold tabular-nums text-muted">{e.time}</span>}
                        <span className="text-sm font-semibold">{e.title}</span>
                        {e.status && (
                          <Badge tone={BOOKING_TONE[e.status]}>
                            {e.status === "confirmado" && <CircleCheck size={11} />}
                            {BOOKING_STATUS[e.status]}
                          </Badge>
                        )}
                      </div>
                      {e.detail && <p className="mt-0.5 text-xs text-muted">{e.detail}</p>}
                    </Link>
                  </li>
                ))}
                {(day.lodging || day.overnightTransit) && (
                  <li className="relative">
                    <span className="absolute -left-[42px] top-0">
                      <KindIcon kind={day.lodging ? "lodging" : "flight"} size="sm" className="opacity-60" />
                    </span>
                    <p className="py-1 text-xs text-muted">
                      {day.lodging ? (
                        <>
                          Duermes en <span className="font-medium text-ink">{day.lodging.name}</span>
                        </>
                      ) : (
                        "Noche en tránsito"
                      )}
                    </p>
                  </li>
                )}
              </ul>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
