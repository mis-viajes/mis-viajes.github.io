import { useTrip } from "@/pages/trip/context";
import { ArrowDown, ArrowUp, BedDouble, MapPin, Plane, TrainFront } from "lucide-react";
import { deleteEntity, moveDestination, saveEntity } from "@/lib/api";
import { DeleteButton } from "@/components/delete-button";
import { RecordDialog } from "@/components/record-dialog";
import { Badge, buttonStyles, Card, EmptyState, PageHeader } from "@/components/ui";
import { datePart, formatDate, nightsBetween, timePart } from "@/lib/domain/dates";
import { formContext } from "@/lib/trip-helpers";

export default function DestinationsPage() {
  const { b, tripId } = useTrip();
  const ctx = formContext(b);

  return (
    <div>
      <PageHeader
        title="Destinos"
        subtitle="Ciudades en orden de visita, con sus fechas, alojamiento y cómo llegarás al siguiente."
        actions={<RecordDialog entity="destination" action={saveEntity.bind(null, "destination", tripId, null, null)} context={ctx} />}
      />
      {b.destinations.length === 0 ? (
        <EmptyState icon={<MapPin size={32} />} title="Sin destinos">
          Añade las ciudades que visitarás. Las reservas y actividades se asociarán a cada destino.
        </EmptyState>
      ) : (
        <ol className="space-y-3">
          {b.destinations.map((d, i) => {
            const next = b.destinations[i + 1];
            const lodgings = b.lodgings.filter((l) => l.destinationId === d.id || (!l.destinationId && l.city?.toLowerCase() === d.city.toLowerCase()));
            const activities = b.activities.filter((a) => a.destinationId === d.id).length;
            const restaurants = b.restaurants.filter((r) => r.destinationId === d.id).length;
            // Desplazamientos que salen el día que se deja este destino.
            const legs = d.departureDate
              ? [
                  ...b.flights.filter((f) => datePart(f.departureLocal) === d.departureDate).map((f) => ({ id: f.id, icon: Plane, text: `${[f.airline, f.flightNumber].filter(Boolean).join(" ") || "Vuelo"} ${f.originCode ?? ""} → ${f.destinationCode ?? ""}`, time: timePart(f.departureLocal) })),
                  ...b.transports.filter((t) => datePart(t.departureLocal) === d.departureDate).map((t) => ({ id: t.id, icon: TrainFront, text: `${t.operator ?? t.type}: ${t.origin ?? "?"} → ${t.destination ?? "?"}`, time: timePart(t.departureLocal) })),
                ]
              : [];
            const nights = nightsBetween(d.arrivalDate, d.departureDate);
            return (
              <li key={d.id}>
                <Card className="p-4">
                  <div className="flex items-start gap-3">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent-soft text-sm font-semibold text-accent">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">{d.city}</h3>
                        {d.country && <span className="text-sm text-muted">{d.country}</span>}
                        {nights !== null && <Badge>{nights} {nights === 1 ? "noche" : "noches"}</Badge>}
                        {d.lat === null && <Badge tone="warning">Sin ubicación</Badge>}
                      </div>
                      <p className="text-sm text-muted">
                        {d.arrivalDate || d.departureDate ? `${formatDate(d.arrivalDate)} → ${formatDate(d.departureDate)}` : "Sin fechas"}
                      </p>
                      <div className="mt-2 space-y-1 text-sm">
                        {lodgings.length > 0 ? (
                          lodgings.map((l) => (
                            <p key={l.id} className="flex items-center gap-1.5">
                              <BedDouble size={14} className="text-muted" /> {l.name}
                              <span className="text-muted">({formatDate(l.checkInDate, "d MMM")} – {formatDate(l.checkOutDate, "d MMM")})</span>
                            </p>
                          ))
                        ) : (
                          <p className="flex items-center gap-1.5 text-muted">
                            <BedDouble size={14} /> Sin alojamiento asociado
                          </p>
                        )}
                        {(activities > 0 || restaurants > 0) && (
                          <p className="text-muted">
                            {activities} {activities === 1 ? "actividad" : "actividades"} · {restaurants} {restaurants === 1 ? "restaurante" : "restaurantes"}
                          </p>
                        )}
                        {next && (
                          <div className="mt-2 rounded-lg bg-surface-2 px-3 py-2">
                            <p className="text-xs font-medium text-muted">Cómo llegarás a {next.city}</p>
                            {legs.length > 0 ? (
                              legs.map((l) => (
                                <p key={l.id} className="flex items-center gap-1.5">
                                  <l.icon size={14} className="text-accent" /> {l.time && <span className="tabular-nums text-muted">{l.time}</span>} {l.text}
                                </p>
                              ))
                            ) : (
                              <p className="text-muted">Aún no hay transporte registrado para el {formatDate(d.departureDate ?? next.arrivalDate)}.</p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row">
                      <form action={moveDestination.bind(null, tripId, d.id, -1)}>
                        <button className={buttonStyles.icon} disabled={i === 0} aria-label="Subir" title="Subir">
                          <ArrowUp size={16} />
                        </button>
                      </form>
                      <form action={moveDestination.bind(null, tripId, d.id, 1)}>
                        <button className={buttonStyles.icon} disabled={i === b.destinations.length - 1} aria-label="Bajar" title="Bajar">
                          <ArrowDown size={16} />
                        </button>
                      </form>
                      <RecordDialog entity="destination" mode="edit" action={saveEntity.bind(null, "destination", tripId, d.id, null)} initial={d} context={ctx} />
                      <DeleteButton
                        itemName={d.city}
                        warning="Las reservas y actividades asociadas se conservarán, pero quedarán sin destino."
                        action={deleteEntity.bind(null, "destination", tripId, d.id, null)}
                      />
                    </div>
                  </div>
                </Card>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
