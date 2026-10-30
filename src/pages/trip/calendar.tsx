import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState, type DragEvent } from "react";
import { Link, useSearchParams } from "react-router";
import { KINDS } from "@/components/kind-icon";
import { eventsOf, TripTimeline, type TimelineEvent } from "@/components/trip-timeline";
import { buttonStyles, Card, cx, FilterChip, PageHeader, SectionTitle } from "@/components/ui";
import { moveActivity } from "@/lib/api";
import { formatDate, monthWeeks, shiftDate, shiftMonth, todayISO, weekDays } from "@/lib/domain/dates";
import { buildItinerary, type DayPlan } from "@/lib/domain/itinerary";
import { useTrip } from "@/pages/trip/context";

const VIEWS = { mes: "Mes", semana: "Semana", dia: "Día" } as const;
type View = keyof typeof VIEWS;
const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export default function CalendarPage() {
  const { b, tripId } = useTrip();
  const [searchParams, setSearchParams] = useSearchParams();
  const view: View = searchParams.get("vista") === "semana" ? "semana" : searchParams.get("vista") === "dia" ? "dia" : "mes";
  const today = todayISO();
  const inTrip = b.trip.startDate <= today && today <= b.trip.endDate;
  const [cursor, setCursor] = useState(inTrip ? today : b.trip.startDate);
  const [error, setError] = useState<string | null>(null);

  const days = new Map(buildItinerary(b).map((d) => [d.date, d]));
  const events = (date: string) => {
    const day = days.get(date);
    return day ? eventsOf(day, tripId, b.trip.baseCurrency) : [];
  };

  const drop = async (e: DragEvent, date: string | null) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/activity");
    if (!id) return;
    setError(null);
    try {
      await moveActivity(tripId, id, date);
    } catch {
      setError("No se pudo mover la actividad. Revisa tu conexión.");
    }
  };

  const shift = (direction: -1 | 1) =>
    setCursor(view === "mes" ? shiftMonth(cursor, direction) : shiftDate(cursor, view === "semana" ? direction * 7 : direction));
  const heading =
    view === "mes"
      ? formatDate(cursor, "MMMM yyyy")
      : view === "semana"
        ? `${formatDate(weekDays(cursor)[0], "d MMM")} – ${formatDate(weekDays(cursor)[6], "d MMM yyyy")}`
        : formatDate(cursor, "EEEE d 'de' MMMM");
  const unscheduled = b.activities.filter((a) => !a.date && a.bookingStatus !== "cancelado");
  const dayPlan = days.get(cursor);

  return (
    <div>
      <PageHeader title="Calendario" subtitle="Toca un número para ver el día. Arrastra una actividad a otro día para moverla." />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2 text-sm">
          {Object.entries(VIEWS).map(([value, label]) => (
            <FilterChip key={value} href={`/trips/${tripId}/calendar?vista=${value}`} active={view === value}>{label}</FilterChip>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <button type="button" className={buttonStyles.icon} onClick={() => shift(-1)} aria-label="Anterior"><ChevronLeft size={18} /></button>
          <span className="min-w-44 text-center text-sm font-semibold capitalize">{heading}</span>
          <button type="button" className={buttonStyles.icon} onClick={() => shift(1)} aria-label="Siguiente"><ChevronRight size={18} /></button>
        </div>
      </div>
      {error && <p className="mb-3 text-sm text-danger">{error}</p>}

      {view === "dia" ? (
        dayPlan ? (
          <TripTimeline days={[dayPlan]} tripId={tripId} base={b.trip.baseCurrency} today={today} />
        ) : (
          <Card className="p-4 text-sm text-muted">Este día está fuera de las fechas del viaje.</Card>
        )
      ) : (
        <Card className="overflow-hidden">
          <div className="grid grid-cols-7 border-b border-line bg-surface-2 text-center text-xs font-medium text-muted">
            {WEEKDAYS.map((d) => <div key={d} className="py-1.5">{d}</div>)}
          </div>
          {(view === "mes" ? monthWeeks(cursor) : [weekDays(cursor)]).map((week) => (
            <div key={week[0]} className="grid grid-cols-7 divide-x divide-line border-b border-line last:border-b-0">
              {week.map((date) => (
                <DayCell
                  key={date}
                  date={date}
                  plan={days.get(date)}
                  events={events(date)}
                  muted={view === "mes" && date.slice(0, 7) !== cursor.slice(0, 7)}
                  today={date === today}
                  tall={view === "semana"}
                  onOpen={() => {
                    setCursor(date);
                    setSearchParams({ vista: "dia" });
                  }}
                  onDrop={drop}
                />
              ))}
            </div>
          ))}
        </Card>
      )}

      {unscheduled.length > 0 && (
        <section className="mt-6" onDragOver={(e) => e.preventDefault()} onDrop={(e) => drop(e, null)}>
          <SectionTitle title="Actividades sin fecha" subtitle="Arrástralas a un día del calendario." />
          <div className="flex flex-wrap gap-2">
            {unscheduled.map((a) => (
              <span
                key={a.id}
                draggable
                onDragStart={(e) => e.dataTransfer.setData("text/activity", a.id)}
                className="cursor-grab rounded-full border border-line bg-surface px-3 py-1 text-sm"
              >
                {a.name}
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function DayCell({ date, plan, events, muted, today, tall, onOpen, onDrop }: {
  date: string;
  plan: DayPlan | undefined;
  events: TimelineEvent[];
  muted: boolean;
  today: boolean;
  tall: boolean;
  onOpen: () => void;
  onDrop: (e: DragEvent, date: string) => void;
}) {
  const [over, setOver] = useState(false);
  const limit = tall ? events.length : 3;
  return (
    <div
      data-date={date}
      onDragOver={(e) => {
        if (!plan) return;
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        setOver(false);
        onDrop(e, date);
      }}
      className={cx("min-w-0 p-1", tall ? "min-h-64" : "min-h-16 sm:min-h-28", !plan && "bg-surface-2/50", over && "bg-accent-soft")}
    >
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Ver el ${formatDate(date, "d 'de' MMMM")}`}
        className={cx("mb-0.5 grid h-6 w-6 place-items-center rounded-full text-xs hover:bg-surface-2", today ? "bg-accent font-semibold text-accent-ink" : muted ? "text-muted/60" : "text-muted")}
      >
        {Number(date.slice(8))}
      </button>
      {plan?.destinations[0] && <p className="hidden truncate text-[10px] font-medium text-accent sm:block">{plan.destinations.map((d) => d.city).join(" · ")}</p>}
      {/* En el celular las celdas son estrechas: un punto por evento. */}
      <div className="flex flex-wrap gap-0.5 sm:hidden">
        {events.map((e) => <span key={e.key} className="h-1.5 w-1.5 rounded-full" style={{ background: KINDS[e.kind].color }} title={e.title} />)}
      </div>
      <ul className="hidden space-y-0.5 sm:block">
        {events.slice(0, limit).map((e) => (
          <li key={e.key}>
            <Link
              to={e.href}
              draggable={e.kind === "activity"}
              onDragStart={(ev) => ev.dataTransfer.setData("text/activity", e.key)}
              className="block truncate rounded px-1 py-0.5 text-[11px] leading-tight hover:bg-surface-2"
              title={[e.time, e.title].filter(Boolean).join(" ")}
            >
              <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full align-middle" style={{ background: KINDS[e.kind].color }} />
              {e.time && <span className="tabular-nums text-muted">{e.time} </span>}
              {e.title}
            </Link>
          </li>
        ))}
        {events.length > limit && <li className="px-1 text-[11px] text-muted">+{events.length - limit} más</li>}
      </ul>
    </div>
  );
}
