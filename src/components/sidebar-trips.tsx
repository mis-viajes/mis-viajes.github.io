import { Link } from "react-router";
import { todayISO, tripPhase } from "@/lib/domain/dates";
import { useTrips } from "@/lib/hooks";

export function SidebarTrips() {
  const { data: trips } = useTrips();
  if (!trips) return <p className="px-3 py-2 text-xs text-muted">Cargando viajes…</p>;
  const today = todayISO();
  const active = trips.filter((t) => tripPhase(t, today) === "en_curso" || tripPhase(t, today) === "futuro");
  if (active.length === 0) return <p className="px-2.5 py-1 text-xs text-muted">Sin viajes próximos.</p>;
  return (
    <ul className="space-y-0.5">
      {active.map((t) => (
        <li key={t.id}>
          <Link to={`/trips/${t.id}`} className="block truncate rounded-lg px-2.5 py-1.5 text-sm text-muted hover:bg-surface-2 hover:text-ink">
            {tripPhase(t, today) === "en_curso" && <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-success" aria-label="En curso" />}
            {t.name}
          </Link>
        </li>
      ))}
    </ul>
  );
}
