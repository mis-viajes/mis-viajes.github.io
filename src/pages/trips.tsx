import { Plus } from "lucide-react";
import { TripCard } from "@/components/trip-card";
import { ButtonLink, EmptyState, PageHeader, SectionTitle } from "@/components/ui";
import { deleteEntity } from "@/lib/api";
import { useAllBundles } from "@/lib/hooks";
import { DataError, LoadingSkeleton } from "./status";
import { todayISO, tripPhase } from "@/lib/domain/dates";

export default function TripsPage() {
  const { data: bundles, loading, error } = useAllBundles();
  if (error && !bundles) return <DataError error={error} />;
  if (loading && !bundles) return <LoadingSkeleton />;
  if (!bundles) return null;
  const today = todayISO();
  const groups = [
    { key: "en_curso", title: "En curso" },
    { key: "futuro", title: "Próximos" },
    { key: "finalizado", title: "Realizados" },
    { key: "cancelado", title: "Cancelados" },
  ] as const;

  return (
    <div>
      <PageHeader
        title="Mis viajes"
        subtitle={`${bundles.length} ${bundles.length === 1 ? "viaje" : "viajes"}`}
        actions={
          <ButtonLink to="/trips/new" variant="primary">
            <Plus size={16} /> Nuevo viaje
          </ButtonLink>
        }
      />
      {bundles.length === 0 ? (
        <EmptyState title="Todavía no tienes viajes">Crea tu primer viaje para empezar a planificar.</EmptyState>
      ) : (
        <div className="space-y-8">
          {groups.map((g) => {
            const list = bundles.filter((b) => tripPhase(b.trip, today) === g.key);
            if (list.length === 0) return null;
            const ordered = g.key === "finalizado" || g.key === "cancelado" ? [...list].reverse() : list;
            return (
              <section key={g.key}>
                <SectionTitle title={g.title} />
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {ordered.map((b) => (
                    <TripCard key={b.trip.id} bundle={b} today={today} onDelete={() => deleteEntity("trip", b.trip.id, b.trip.id, null)} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
