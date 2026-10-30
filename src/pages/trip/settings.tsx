import { useState } from "react";
import { useNavigate } from "react-router";
import { useTrip } from "@/pages/trip/context";
import { Copy, Users } from "lucide-react";
import { deleteEntity, duplicateTrip, saveEntity } from "@/lib/api";
import { DeleteButton } from "@/components/delete-button";
import { RecordDialog } from "@/components/record-dialog";
import { buttonStyles, Card, PageHeader, SectionTitle } from "@/components/ui";
import { formatDate } from "@/lib/domain/dates";
import { formatMoney } from "@/lib/domain/money";
import { TRIP_STATUS } from "@/lib/labels";

export default function SettingsPage() {
  const { b, tripId } = useTrip();
  const navigate = useNavigate();
  const [duplicating, setDuplicating] = useState(false);
  const { trip } = b;
  const ctx = { baseCurrency: trip.baseCurrency };

  return (
    <div className="space-y-8">
      <PageHeader title="Ajustes del viaje" />

      <section>
        <SectionTitle
          title="Información general"
          action={<RecordDialog entity="trip" mode="edit" variant="secondary" label="Editar" action={saveEntity.bind(null, "trip", tripId, tripId, null)} initial={trip} context={ctx} />}
        />
        <Card className="grid gap-4 p-4 sm:grid-cols-3">
          <Info label="Nombre">{trip.name}</Info>
          <Info label="Fechas">{formatDate(trip.startDate)} – {formatDate(trip.endDate)}</Info>
          <Info label="Estado">{TRIP_STATUS[trip.status]}</Info>
          <Info label="Moneda principal">{trip.baseCurrency}</Info>
          <Info label="Presupuesto">{trip.budgetMinor !== null ? formatMoney(trip.budgetMinor, trip.baseCurrency) : "Sin definir"}</Info>
          <Info label="Descripción">{trip.description ?? "—"}</Info>
        </Card>
        <p className="mt-2 text-xs text-muted">
          Cambiar la moneda principal no recalcula los gastos ya registrados: cada gasto conserva el importe convertido con su tipo de cambio original.
        </p>
      </section>

      <section>
        <SectionTitle
          title="Viajeros"
          subtitle="Se usan para dividir gastos y saber cuánto ha pagado cada persona."
          action={<RecordDialog entity="traveler" action={saveEntity.bind(null, "traveler", tripId, null, null)} context={ctx} variant="secondary" />}
        />
        {b.travelers.length === 0 ? (
          <Card className="flex items-center gap-2 p-4 text-sm text-muted">
            <Users size={16} /> Aún no hay viajeros.
          </Card>
        ) : (
          <Card className="divide-y divide-line">
            {b.travelers.map((t) => (
              <div key={t.id} className="flex items-center justify-between px-4 py-2.5">
                <span className="text-sm font-medium">{t.name}</span>
                <span className="flex items-center">
                  <RecordDialog entity="traveler" mode="edit" action={saveEntity.bind(null, "traveler", tripId, t.id, null)} initial={t} context={ctx} />
                  <DeleteButton
                    itemName={t.name}
                    warning="Se eliminarán sus partes en los gastos compartidos y los gastos que pagó quedarán sin pagador."
                    action={deleteEntity.bind(null, "traveler", tripId, t.id, null)}
                  />
                </span>
              </div>
            ))}
          </Card>
        )}
      </section>

      <section>
        <SectionTitle title="Plantilla" subtitle="Crea un viaje nuevo con los mismos destinos, viajeros, actividades y restaurantes, sin reservas ni gastos." />
        <button
          type="button"
          className={buttonStyles.secondary}
          disabled={duplicating}
          onClick={async () => {
            setDuplicating(true);
            try {
              navigate(`/trips/${await duplicateTrip(tripId)}/settings`);
            } finally {
              setDuplicating(false);
            }
          }}
        >
          <Copy size={16} /> {duplicating ? "Duplicando…" : "Duplicar como plantilla"}
        </button>
      </section>

      <section>
        <SectionTitle title="Zona de peligro" />
        <Card className="flex flex-wrap items-center justify-between gap-3 border-danger/40 p-4">
          <p className="text-sm">Eliminar el viaje borra todas sus reservas, gastos y documentos.</p>
          <DeleteButton
            label="Eliminar viaje"
            itemName={trip.name}
            warning="Se borrarán todos los datos y archivos del viaje. Considera exportar los gastos antes."
            action={async () => {
              await deleteEntity("trip", tripId, tripId, null);
              navigate("/trips");
            }}
          />
        </Card>
      </section>
    </div>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <p className="text-sm">{children}</p>
    </div>
  );
}
