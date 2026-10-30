import { ImportWizard } from "@/components/import/import-wizard";
import { PageHeader } from "@/components/ui";
import { formContext } from "@/lib/trip-helpers";
import { useTrip } from "./context";

export default function ImportPage() {
  const { b, tripId, rates } = useTrip();
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Importar reservas"
        subtitle="Sube la confirmación de un vuelo, hotel, tren o entrada (PDF, captura o texto del correo). Se extraen fechas, horarios, precios, direcciones, códigos y equipaje para que los revises."
      />
      <ImportWizard
        tripId={tripId}
        trip={{ name: b.trip.name, startDate: b.trip.startDate, endDate: b.trip.endDate }}
        context={formContext(b)}
        destinations={b.destinations}
        travelers={b.travelers.map((t) => ({ id: t.id, name: t.name }))}
        rates={rates}
      />
    </div>
  );
}
