import { Outlet, useNavigate, useParams } from "react-router";
import { DeleteButton } from "@/components/delete-button";
import { deleteEntity } from "@/lib/api";
import { TripTabs } from "@/components/trip-tabs";
import { Badge } from "@/components/ui";
import { formatDate, todayISO, tripDays, tripPhase } from "@/lib/domain/dates";
import { useLatestRates, useTripBundle } from "@/lib/hooks";
import { TRIP_PHASE } from "@/lib/labels";
import { tripCities } from "@/lib/trip-helpers";
import { DataError, LoadingSkeleton } from "../status";
import NotFound from "../not-found";
import type { TripContext } from "./context";

export default function TripLayout() {
  const { tripId = "" } = useParams();
  const { data: bundle, loading, error } = useTripBundle(tripId);
  const rates = useLatestRates();
  const navigate = useNavigate();

  if (error && !bundle) return <DataError error={error} />;
  if (loading && bundle === undefined) return <LoadingSkeleton />;
  if (!bundle) return <NotFound />;
  const { trip } = bundle;
  const phase = tripPhase(trip, todayISO());
  const cities = tripCities(bundle);

  return (
    <div>
      <title>{`${trip.name} · Travel Manager`}</title>
      <div className="mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{trip.name}</h1>
          <Badge tone={phase === "en_curso" ? "success" : phase === "futuro" ? "accent" : phase === "cancelado" ? "danger" : "neutral"}>
            {TRIP_PHASE[phase]}
          </Badge>
          <div className="ml-auto">
            <DeleteButton
              label="Eliminar"
              itemName={`el viaje «${trip.name}»`}
              warning="Se borrarán todas sus reservas, gastos y documentos. Considera exportar los gastos antes."
              action={async () => {
                await deleteEntity("trip", tripId, tripId, null);
                navigate("/trips");
              }}
            />
          </div>
        </div>
        <p className="mt-1 text-sm text-muted">
          {formatDate(trip.startDate)} – {formatDate(trip.endDate)} · {tripDays(trip.startDate, trip.endDate)} días
          {cities.length > 0 && ` · ${cities.join(" → ")}`}
        </p>
      </div>
      <TripTabs tripId={tripId} />
      <div className="mt-5">
        <Outlet context={{ tripId, b: bundle, rates } satisfies TripContext} />
      </div>
    </div>
  );
}
