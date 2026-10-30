import { useTrip } from "@/pages/trip/context";
import { BedDouble, CircleCheck, FileDown, Plane, Wallet } from "lucide-react";
import { lazy, Suspense } from "react";
import { Link } from "react-router";
import { AlertList } from "@/components/alert-list";
import { DestinationCards } from "@/components/destination-cards";
import { TripTimeline } from "@/components/trip-timeline";
import { Badge, BOOKING_TONE, Card, cx, EmptyState, ProgressBar, SectionTitle } from "@/components/ui";
import { computeAlerts } from "@/lib/domain/alerts";
import { todayISO } from "@/lib/domain/dates";
import { hasCoords } from "@/lib/domain/geo";
import { summarizeFinances } from "@/lib/domain/finance";
import { buildItinerary } from "@/lib/domain/itinerary";
import { formatMoney } from "@/lib/domain/money";
import { BOOKING_STATUS, TRANSPORT_TYPE } from "@/lib/labels";

const RouteMap = lazy(() => import("@/components/map/route-map"));

/** Indicador grande con icono de color. */
function Metric({ icon: Icon, color, label, value, hint, progress }: { icon: typeof Plane; color: string; label: string; value: string; hint?: string; progress?: number }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white" style={{ background: color }}>
          <Icon size={19} />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted">{label}</p>
          <p className="truncate text-xl font-bold tabular-nums">{value}</p>
        </div>
      </div>
      {progress !== undefined && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-2">
          <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%`, background: color }} />
        </div>
      )}
      {hint && <p className="mt-1.5 text-xs text-muted">{hint}</p>}
    </Card>
  );
}

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

  const hasMap = bundle.destinations.filter(hasCoords).length > 0;
  const isEmpty = bundle.destinations.length + bundle.flights.length + bundle.lodgings.length + bundle.activities.length === 0;

  return (
    <div className="space-y-8">
      {trip.description && <p className="max-w-3xl text-sm text-muted">{trip.description}</p>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric
          icon={CircleCheck}
          color="#15803d"
          label="Reservas confirmadas"
          value={`${confirmed} de ${bookings.length}`}
          progress={bookings.length ? confirmed / bookings.length : 0}
        />
        <Metric
          icon={BedDouble}
          color="#7c3aed"
          label="Noches con alojamiento"
          value={`${coveredNights} de ${nights}`}
          progress={nights ? coveredNights / nights : 0}
        />
        <Metric icon={Plane} color="#2563eb" label="Vuelos" value={String(bundle.flights.filter((f) => f.bookingStatus !== "cancelado").length)} hint={`${bundle.destinations.length} destinos`} />
        <Metric
          icon={Wallet}
          color="#d97706"
          label={finance.budget !== null ? "Presupuesto restante" : "Pagado"}
          value={finance.budget !== null ? formatMoney(finance.budgetRemaining, base) : formatMoney(finance.totals.paid, base)}
          hint={finance.budget !== null ? `Previsto ${formatMoney(finance.totals.projected, base)}` : `Pendiente ${formatMoney(finance.totals.pending, base)}`}
          progress={finance.budget ? finance.totals.projected / finance.budget : undefined}
        />
      </div>
      {finance.budget !== null && finance.totals.projected > finance.budget && (
        <ProgressBar value={finance.totals.projected} max={finance.budget} tone="danger" />
      )}

      {bundle.destinations.length > 0 && (
        <section>
          <SectionTitle title="Destinos" subtitle="En orden de visita" />
          <DestinationCards bundle={bundle} />
        </section>
      )}

      {(hasMap || alerts.length > 0) && (
        <div className={cx("grid gap-4", hasMap && alerts.length > 0 && "lg:grid-cols-[3fr_2fr]")}>
          {hasMap && (
            <section>
              <SectionTitle title="Ruta" subtitle="Ciudades en orden y vuelos" action={<Link to={`/trips/${tripId}/map`} className="text-sm text-accent hover:underline">Mapa completo →</Link>} />
              <div className="h-72 overflow-hidden rounded-xl border border-line sm:h-80">
                <Suspense fallback={<div className="grid h-full place-items-center bg-surface-2 text-sm text-muted">Cargando mapa…</div>}>
                  <RouteMap bundle={bundle} />
                </Suspense>
              </div>
            </section>
          )}
          {alerts.length > 0 && (
            <section>
              <SectionTitle title="Alertas" subtitle={`${alerts.length} ${alerts.length === 1 ? "aviso" : "avisos"}`} />
              <div className="space-y-2">
                {alerts.map((a) => (
                  <AlertList key={a.id} alerts={[a]} tripId={tripId} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {isEmpty && (
        <EmptyState title="Empieza a planificar este viaje">
          Añade <Link className="text-accent underline" to={`/trips/${tripId}/destinations`}>destinos</Link>, registra tus{" "}
          <Link className="text-accent underline" to={`/trips/${tripId}/flights`}>vuelos</Link> y{" "}
          <Link className="text-accent underline" to={`/trips/${tripId}/lodging`}>alojamientos</Link>, o{" "}
          <Link className="text-accent underline" to={`/trips/${tripId}/import`}>importa una confirmación</Link> en PDF o imagen.
        </EmptyState>
      )}

      <section>
        <SectionTitle
          title="Día a día"
          subtitle="Dónde estarás, cómo te moverás, dónde dormirás y qué harás"
          action={<Link to={`/trips/${tripId}/print`} className="inline-flex items-center gap-1 text-sm text-accent hover:underline"><FileDown size={15} /> PDF</Link>}
        />
        <TripTimeline days={days} tripId={tripId} base={base} today={today} />
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
