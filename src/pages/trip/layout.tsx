import { Outlet, useNavigate, useParams } from "react-router";
import { DeleteButton } from "@/components/delete-button";
import { deleteEntity } from "@/lib/api";
import { TripHero } from "@/components/trip-hero";
import { TripTabs } from "@/components/trip-tabs";
import { useLatestRates, useTripBundle } from "@/lib/hooks";
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

  return (
    <div>
      <title>{`${trip.name} · Travel Manager`}</title>
      <TripHero
        bundle={bundle}
        actions={
          <DeleteButton
            label="Eliminar"
            itemName={`el viaje «${trip.name}»`}
            warning="Se borrarán todas sus reservas, gastos y documentos. Considera exportar los gastos antes."
            className="!border-white/20 !bg-black/30 !px-2.5 !py-1.5 !text-xs !text-white backdrop-blur hover:!bg-black/45"
            action={async () => {
              await deleteEntity("trip", tripId, tripId, null);
              navigate("/trips");
            }}
          />
        }
      />
      <TripTabs tripId={tripId} />
      <div className="mt-5">
        <Outlet context={{ tripId, b: bundle, rates } satisfies TripContext} />
      </div>
    </div>
  );
}
