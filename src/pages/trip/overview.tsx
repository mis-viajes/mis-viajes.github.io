import { useTrip } from "@/pages/trip/context";
import { BedDouble, CircleCheck, LogIn, LogOut, MapPin, Plane, Ticket, TrainFront, Utensils } from "lucide-react";
import { Link } from "react-router";
import { AlertList } from "@/components/alert-list";
import { Badge, BOOKING_TONE, Card, EmptyState, ProgressBar, SectionTitle, Stat } from "@/components/ui";
import { computeAlerts } from "@/lib/domain/alerts";
import { formatDayHeading, nightsBetween, timePart, todayISO } from "@/lib/domain/dates";
import { summarizeFinances } from "@/lib/domain/finance";
import { buildItinerary, type DayPlan } from "@/lib/domain/itinerary";
import { formatMoney } from "@/lib/domain/money";
import { BOOKING_STATUS, TRANSPORT_TYPE } from "@/lib/labels";

export default function TripOverviewPage() {
  const { b, tripId } = useTrip();
  const bundle = b;
  const now = new Date();
  const today = todayISO(now);
  const { trip } = bundle;
  const base = trip.baseCurrency;

  const alerts = computeAlerts(bundle, now, today);
  const finance = summarizeFinances(bundle.expenses, bundle.travelers, base, trip.budgetMinor);
  const days = buildItinerary(bundle);

  // Las noches en vuelo o trayecto nocturno no necesitan alojamiento.
  const nights = days.slice(0, -1).filter((d) => !d.overnightTransit || d.lodging).length;
  const coveredNights = days.slice(0, -1).filter((d) => d.lodging).length;
  const bookings = [
    ...bundle.flights.map((f) => ({ id: f.id, kind: "Vuelo", name: [f.airline, f.flightNumber].filter(Boolean).join(" ") || `${f.originCode ?? "?"} → ${f.destinationCode ?? "?"}`, status: f.bookingStatus, href: "flights" })),
    ...bundle.lodgings.map((l) => ({ id: l.id, kind: "Alojamiento", name: l.name, status: l.bookingStatus, href: "lodging" })),
    ...bundle.transports.map((t) => ({ id: t.id, kind: TRANSPORT_TYPE[t.type], name: `${t.origin ?? "?"} → ${t.destination ?? "?"}`, status: t.bookingStatus, href: "transport" })),
    ...bundle.activities.filter((a) => a.requiresBooking).map((a) => ({ id: a.id, kind: "Actividad", name: a.name, status: a.bookingStatus, href: "activities" })),
  ].filter((b) => b.status !== "cancelado");
  const confirmed = bookings.filter((b) => b.status === "confirmado").length;

  const isEmpty = bundle.destinations.length + bundle.flights.length + bundle.lodgings.length + bundle.activities.length === 0;

  return (
    <div className="space-y-8">
      {trip.description && <p className="max-w-3xl text-sm text-muted">{trip.description}</p>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Noches con alojamiento" value={`${coveredNights} / ${nights}`} tone={coveredNights < nights ? "warning" : "success"} />
        <Stat label="Reservas confirmadas" value={`${confirmed} / ${bookings.length}`} tone={confirmed < bookings.length ? "warning" : "success"} />
        <Stat label="Pagado" value={formatMoney(finance.totals.paid, base)} hint={`Pendiente: ${formatMoney(finance.totals.pending, base)}`} />
        <Stat
          label={finance.budget !== null ? "Presupuesto restante" : "Total previsto"}
          value={finance.budget !== null ? formatMoney(finance.budgetRemaining, base) : formatMoney(finance.totals.projected, base)}
          tone={finance.budgetRemaining !== null && finance.budgetRemaining < 0 ? "danger" : undefined}
          hint={finance.budget !== null ? `Previsto ${formatMoney(finance.totals.projected, base)} de ${formatMoney(finance.budget, base)}` : "Pagado + pendiente + previsto"}
        />
      </div>
      {finance.budget !== null && (
        <ProgressBar value={finance.totals.projected} max={finance.budget} tone={finance.totals.projected > finance.budget ? "danger" : "accent"} />
      )}

      {isEmpty && (
        <EmptyState title="Empieza a planificar este viaje">
          Añade <Link className="text-accent underline" to={`/trips/${tripId}/destinations`}>destinos</Link>, registra tus{" "}
          <Link className="text-accent underline" to={`/trips/${tripId}/flights`}>vuelos</Link> y{" "}
          <Link className="text-accent underline" to={`/trips/${tripId}/lodging`}>alojamientos</Link>, o{" "}
          <Link className="text-accent underline" to={`/trips/${tripId}/import`}>importa una confirmación</Link> en PDF o imagen.
        </EmptyState>
      )}

      {alerts.length > 0 && (
        <section>
          <SectionTitle title="Alertas" subtitle={`${alerts.length} ${alerts.length === 1 ? "aviso" : "avisos"}`} />
          <div className="grid gap-2 md:grid-cols-2">
            {alerts.map((a) => (
              <AlertList key={a.id} alerts={[a]} tripId={tripId} />
            ))}
          </div>
        </section>
      )}

      <section>
        <SectionTitle title="Día a día" subtitle="Dónde estarás, cómo te moverás, dónde dormirás y qué harás" />
        <div className="space-y-3">
          {days.map((d) => (
            <DayCard key={d.date} day={d} today={today} base={base} />
          ))}
        </div>
      </section>

      {bookings.length > 0 && (
        <section>
          <SectionTitle title="Estado de las reservas" />
          <Card className="divide-y divide-line">
            {bookings.map((b) => (
              <Link key={b.id} to={`/trips/${tripId}/${b.href}`} className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-surface-2">
                <span className="min-w-0 truncate text-sm">
                  <span className="text-muted">{b.kind} · </span>
                  {b.name}
                </span>
                <Badge tone={BOOKING_TONE[b.status]}>
                  {b.status === "confirmado" && <CircleCheck size={12} />}
                  {BOOKING_STATUS[b.status]}
                </Badge>
              </Link>
            ))}
          </Card>
        </section>
      )}
    </div>
  );
}

function Row({ icon: Icon, time, children, tone }: { icon: typeof Plane; time?: string | null; children: React.ReactNode; tone?: string }) {
  return (
    <li className="flex items-start gap-2.5 text-sm">
      <Icon size={15} className={`mt-0.5 shrink-0 ${tone ?? "text-muted"}`} />
      {time && <span className="w-11 shrink-0 tabular-nums text-muted">{time}</span>}
      <span className="min-w-0">{children}</span>
    </li>
  );
}

function DayCard({ day, today, base }: { day: DayPlan; today: string; base: string }) {
  const isToday = day.date === today;
  const empty =
    !day.lodging && !day.overnightTransit && day.flights.length + day.transports.length + day.activities.length + day.restaurants.length + day.checkIns.length + day.checkOuts.length === 0;
  return (
    <Card className={`p-4 ${isToday ? "border-accent ring-1 ring-accent/30" : ""}`}>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-accent">Día {day.dayNumber}</span>
        <span className="text-sm font-medium capitalize">{formatDayHeading(day.date)}</span>
        {isToday && <Badge tone="accent">Hoy</Badge>}
        {day.destinations.map((d) => (
          <Badge key={d.id}>
            <MapPin size={11} /> {d.city}
          </Badge>
        ))}
      </div>
      {empty ? (
        <p className="text-sm text-muted">Sin planes registrados.</p>
      ) : (
        <ul className="space-y-1.5">
          {day.checkOuts.map((l) => (
            <Row key={`out-${l.id}`} icon={LogOut} time={l.checkOutTime}>
              Check-out de <strong>{l.name}</strong>
            </Row>
          ))}
          {day.flights.map((f) => (
            <Row key={f.id} icon={Plane} time={timePart(f.departureLocal)} tone="text-accent">
              {[f.airline, f.flightNumber].filter(Boolean).join(" ") || "Vuelo"}: {f.originCode ?? f.originName ?? "?"} → {f.destinationCode ?? f.destinationName ?? "?"}
              {f.arrivalLocal && <span className="text-muted"> · llega {timePart(f.arrivalLocal)}</span>}{" "}
              <Badge tone={BOOKING_TONE[f.bookingStatus]}>{BOOKING_STATUS[f.bookingStatus]}</Badge>
            </Row>
          ))}
          {day.transports.map((t) => (
            <Row key={t.id} icon={TrainFront} time={timePart(t.departureLocal)} tone="text-accent">
              {TRANSPORT_TYPE[t.type]} {t.operator ? `(${t.operator})` : ""}: {t.origin ?? "?"} → {t.destination ?? "?"}
              {t.arrivalLocal && <span className="text-muted"> · llega {timePart(t.arrivalLocal)}</span>}{" "}
              <Badge tone={BOOKING_TONE[t.bookingStatus]}>{BOOKING_STATUS[t.bookingStatus]}</Badge>
            </Row>
          ))}
          {day.checkIns.map((l) => (
            <Row key={`in-${l.id}`} icon={LogIn} time={l.checkInTime}>
              Check-in en <strong>{l.name}</strong>
              {l.city && <span className="text-muted"> · {l.city}</span>}
              {nightsBetween(l.checkInDate, l.checkOutDate) !== null && <span className="text-muted"> · {nightsBetween(l.checkInDate, l.checkOutDate)} noches</span>}
            </Row>
          ))}
          {day.activities.map((a) => (
            <Row key={a.id} icon={Ticket} time={a.startTime}>
              {a.name}
              {a.priceMinor !== null && <span className="text-muted"> · {formatMoney(a.priceMinor, a.currency ?? base)}</span>}
              {a.requiresBooking && (
                <>
                  {" "}
                  <Badge tone={BOOKING_TONE[a.bookingStatus]}>{BOOKING_STATUS[a.bookingStatus]}</Badge>
                </>
              )}
            </Row>
          ))}
          {day.restaurants.map((r) => (
            <Row key={r.id} icon={Utensils} time={timePart(r.reservedAt)}>
              Reserva en {r.name}
            </Row>
          ))}
          {!day.lodging && day.overnightTransit && (
            <Row icon={BedDouble}>
              <span className="text-muted">Noche en tránsito</span>
            </Row>
          )}
          {day.lodging && (
            <Row icon={BedDouble}>
              <span className="text-muted">Duermes en </span>
              {day.lodging.name}
              {day.lodging.bookingStatus !== "confirmado" && (
                <>
                  {" "}
                  <Badge tone={BOOKING_TONE[day.lodging.bookingStatus]}>{BOOKING_STATUS[day.lodging.bookingStatus]}</Badge>
                </>
              )}
            </Row>
          )}
        </ul>
      )}
    </Card>
  );
}
