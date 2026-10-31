import type { ReactNode } from "react";
import { CalendarClock, Plane, Plus } from "lucide-react";
import { KindIcon } from "@/components/kind-icon";
import { Link } from "react-router";
import { AlertList } from "@/components/alert-list";
import { TripCard, TripCover } from "@/components/trip-card";
import { ButtonLink, Card, EmptyState, SectionTitle, Stat } from "@/components/ui";
import { useAllBundles } from "@/lib/hooks";
import { DataError, LoadingSkeleton } from "./status";
import { computeAlerts } from "@/lib/domain/alerts";
import { datePart, daysUntil, formatDate, formatDateTimeLocal, todayISO, tripDays, tripPhase } from "@/lib/domain/dates";
import { summarizeFinances } from "@/lib/domain/finance";
import { formatMoney } from "@/lib/domain/money";
import type { TripBundle } from "@/lib/domain/types";
import { tripCities, tripPhotoQuery } from "@/lib/trip-helpers";

type Upcoming = { date: string; sort: string; label: string; detail: string; tripId: string; tripName: string; href: string; kind: "flight" | "lodging" | "transport" | "activity" };

function upcomingEvents(bundles: TripBundle[], today: string, horizonDays = 30): Upcoming[] {
  const out: Upcoming[] = [];
  const inRange = (d: string | null) => d !== null && d >= today && daysUntil(d, today) <= horizonDays;
  for (const b of bundles) {
    if (b.trip.status === "cancelado") continue;
    const base = { tripId: b.trip.id, tripName: b.trip.name };
    for (const f of b.flights) {
      const d = datePart(f.departureLocal);
      if (f.bookingStatus !== "cancelado" && inRange(d))
        out.push({ ...base, date: d!, sort: f.departureLocal!, kind: "flight", href: `/trips/${b.trip.id}/flights`, label: [f.airline, f.flightNumber].filter(Boolean).join(" ") || "Vuelo", detail: `${f.originCode ?? f.originName ?? "?"} → ${f.destinationCode ?? f.destinationName ?? "?"} · ${formatDateTimeLocal(f.departureLocal)}` });
    }
    for (const l of b.lodgings) {
      if (l.bookingStatus !== "cancelado" && inRange(l.checkInDate))
        out.push({ ...base, date: l.checkInDate!, sort: `${l.checkInDate}T${l.checkInTime ?? "15:00"}`, kind: "lodging", href: `/trips/${b.trip.id}/lodging`, label: `Check-in: ${l.name}`, detail: [l.city, formatDate(l.checkInDate, "EEE d MMM"), l.checkInTime].filter(Boolean).join(" · ") });
    }
    for (const t of b.transports) {
      const d = datePart(t.departureLocal);
      if (t.bookingStatus !== "cancelado" && inRange(d))
        out.push({ ...base, date: d!, sort: t.departureLocal!, kind: "transport", href: `/trips/${b.trip.id}/transport`, label: [t.operator, t.serviceNumber].filter(Boolean).join(" ") || "Transporte", detail: `${t.origin ?? "?"} → ${t.destination ?? "?"} · ${formatDateTimeLocal(t.departureLocal)}` });
    }
    for (const a of b.activities) {
      if (a.bookingStatus !== "cancelado" && inRange(a.date))
        out.push({ ...base, date: a.date!, sort: `${a.date}T${a.startTime ?? "23:59"}`, kind: "activity", href: `/trips/${b.trip.id}/activities`, label: a.name, detail: [a.city, formatDate(a.date, "EEE d MMM"), a.startTime].filter(Boolean).join(" · ") });
    }
  }
  return out.sort((a, b) => a.sort.localeCompare(b.sort)).slice(0, 10);
}


function sumByCurrency(entries: [string, number][]): string {
  const map = new Map<string, number>();
  for (const [cur, v] of entries) map.set(cur, (map.get(cur) ?? 0) + v);
  if (map.size === 0) return "—";
  return [...map.entries()].map(([cur, v]) => formatMoney(v, cur)).join(" · ");
}

export default function DashboardPage() {
  const { data: bundles, loading, error } = useAllBundles();
  if (error && !bundles) return <DataError error={error} />;
  if (loading && !bundles) return <LoadingSkeleton />;
  if (!bundles) return null;
  const now = new Date();
  const today = todayISO(now);

  if (bundles.length === 0) {
    return (
      <div className="mx-auto max-w-xl pt-10">
        <EmptyState
          icon={<Plane size={36} />}
          title="Bienvenido a tu Travel Manager"
          action={
            <ButtonLink to="/trips/new" variant="primary">
              <Plus size={16} /> Crear mi primer viaje
            </ButtonLink>
          }
        >
          Crea un viaje para empezar a organizar vuelos, alojamientos, actividades, gastos y documentos en un solo lugar.
        </EmptyState>
      </div>
    );
  }

  const withPhase = bundles.map((b) => ({ b, phase: tripPhase(b.trip, today) }));
  const current = withPhase.filter((x) => x.phase === "en_curso").map((x) => x.b);
  const future = withPhase.filter((x) => x.phase === "futuro").map((x) => x.b);
  const past = withPhase.filter((x) => x.phase === "finalizado").map((x) => x.b).reverse();
  const next = current[0] ?? future[0];

  const visited = new Set(past.flatMap((b) => b.destinations.map((d) => `${d.city}|${d.country ?? ""}`.toLowerCase())));
  const finances = bundles
    .filter((b) => b.trip.status !== "cancelado")
    .map((b) => ({ b, f: summarizeFinances(b.expenses, b.travelers, b.trip.baseCurrency, b.trip.budgetMinor) }));
  const activeBundles = [...current, ...future];
  const alerts = activeBundles.flatMap((b) => computeAlerts(b, now, today).map((a) => ({ a, b })));
  const upcoming = upcomingEvents(activeBundles, today);

  return (
    <div className="space-y-8">
      {next && <NextTrip bundle={next} today={today} />}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Viajes próximos" value={future.length} hint={current.length ? `${current.length} en curso` : undefined} />
        <Stat label="Viajes realizados" value={past.length} hint={`${visited.size} destinos visitados`} />
        <Stat
          label="Presupuesto total"
          value={<span className="text-base">{sumByCurrency(finances.filter((x) => x.b.trip.budgetMinor !== null).map((x) => [x.b.trip.baseCurrency, x.b.trip.budgetMinor!]))}</span>}
          hint="Suma de viajes activos y pasados"
        />
        <Stat
          label="Gastos pagados"
          value={<span className="text-base">{sumByCurrency(finances.map((x) => [x.b.trip.baseCurrency, x.f.totals.paid]))}</span>}
          hint={`Pendiente: ${sumByCurrency(finances.filter((x) => x.f.totals.pending > 0).map((x) => [x.b.trip.baseCurrency, x.f.totals.pending]))}`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <SectionTitle title="Próximos 30 días" subtitle="Vuelos, check-ins, trayectos y actividades" />
          {upcoming.length === 0 ? (
            <Card className="p-4 text-sm text-muted">No hay reservas ni actividades en los próximos 30 días.</Card>
          ) : (
            <Card className="divide-y divide-line">
              {upcoming.map((u, i) => {
                return (
                  <Link key={i} to={u.href} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2">
                    <KindIcon kind={u.kind} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{u.label}</span>
                      <span className="block truncate text-xs text-muted">
                        {u.tripName} · {u.detail}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-muted">{daysUntil(u.date, today) === 0 ? "Hoy" : `en ${daysUntil(u.date, today)} d`}</span>
                  </Link>
                );
              })}
            </Card>
          )}
        </section>
        <section>
          <SectionTitle title="Alertas y pendientes" subtitle="De tus viajes próximos y en curso" />
          {alerts.length === 0 ? (
            <Card className="p-4 text-sm text-muted">Todo en orden: no hay alertas.</Card>
          ) : (
            <div className="space-y-2">
              {alerts.slice(0, 8).map(({ a, b }) => (
                <AlertList key={`${b.trip.id}-${a.id}`} alerts={[a]} tripId={b.trip.id} tripName={b.trip.name} />
              ))}
              {alerts.length > 8 && <p className="text-xs text-muted">Y {alerts.length - 8} más dentro de cada viaje.</p>}
            </div>
          )}
        </section>
      </div>

      <TripGroup title="En curso" bundles={current} today={today} />
      <TripGroup
        title="Próximos viajes"
        bundles={future}
        today={today}
        action={
          <ButtonLink to="/trips/new" variant="primary">
            <Plus size={16} /> Nuevo viaje
          </ButtonLink>
        }
      />
      <TripGroup title="Historial" bundles={past} today={today} />
    </div>
  );
}

function NextTrip({ bundle, today }: { bundle: TripBundle; today: string }) {
  const { trip } = bundle;
  const phase = tripPhase(trip, today);
  const days = daysUntil(trip.startDate, today);
  const dayNumber = -days + 1;
  return (
    <Link to={`/trips/${trip.id}`} className="block">
      <Card className="relative overflow-hidden">
        <div className="absolute inset-0">
          <TripCover name={trip.name} image={trip.coverImage} query={tripPhotoQuery(bundle)} className="h-full w-full" />
        </div>
        <div className="relative min-h-64 bg-gradient-to-t from-black/80 via-black/45 to-black/35 p-6 text-white sm:p-8">
          <p className="flex items-center gap-1.5 text-sm text-white/80">
            <CalendarClock size={15} /> {phase === "en_curso" ? "Viaje en curso" : "Próximo viaje"}
          </p>
          <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">{trip.name}</h1>
          <p className="mt-1 text-sm text-white/85">
            {tripCities(bundle).join(" · ") || "Sin destinos aún"} · {formatDate(trip.startDate, "d MMM")} – {formatDate(trip.endDate)}
          </p>
          <p className="mt-4 text-4xl font-bold tabular-nums">
            {phase === "en_curso" ? (
              <>
                Día {dayNumber} <span className="text-lg font-medium text-white/80">de {tripDays(trip.startDate, trip.endDate)}</span>
              </>
            ) : days === 0 ? (
              "¡Hoy!"
            ) : (
              <>
                {days} <span className="text-lg font-medium text-white/80">{days === 1 ? "día" : "días"} para salir</span>
              </>
            )}
          </p>
        </div>
      </Card>
    </Link>
  );
}

function TripGroup({ title, bundles, today, action }: { title: string; bundles: TripBundle[]; today: string; action?: ReactNode }) {
  if (bundles.length === 0 && !action) return null;
  return (
    <section>
      <SectionTitle title={title} action={action} />
      {bundles.length === 0 ? (
        <Card className="p-4 text-sm text-muted">No hay viajes en esta sección.</Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {bundles.map((b) => (
            <TripCard key={b.trip.id} bundle={b} today={today} />
          ))}
        </div>
      )}
    </section>
  );
}
