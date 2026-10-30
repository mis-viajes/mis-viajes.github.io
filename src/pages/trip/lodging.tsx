import { useTrip } from "@/pages/trip/context";
import { BedDouble, ExternalLink, MapPin } from "lucide-react";
import { deleteEntity, saveEntity, saveExpense } from "@/lib/api";
import { DeleteButton } from "@/components/delete-button";
import { ExpenseDialog } from "@/components/expense-form";
import { RecordDialog } from "@/components/record-dialog";
import { Sensitive } from "@/components/sensitive";
import { Badge, BOOKING_TONE, Card, Detail, EmptyState, PageHeader } from "@/components/ui";
import { formatDate, nightsBetween } from "@/lib/domain/dates";
import { googleMapsSearchUrl, hasCoords } from "@/lib/domain/geo";
import { suggestDestination } from "@/lib/domain/itinerary";
import { formatMoney } from "@/lib/domain/money";
import { BOOKING_STATUS, LODGING_TYPE } from "@/lib/labels";
import { destinationName, expenseFormBase, formContext, hasExpense } from "@/lib/trip-helpers";

export default function LodgingPage() {
  const { b, tripId, rates } = useTrip();
  const ctx = formContext(b);
  const base = b.trip.baseCurrency;

  return (
    <div>
      <PageHeader
        title="Alojamiento"
        subtitle="Hoteles, Airbnb, apartamentos y hostales en orden cronológico."
        actions={<RecordDialog entity="lodging" action={saveEntity.bind(null, "lodging", tripId, null, null)} context={ctx} />}
      />
      {b.lodgings.length === 0 ? (
        <EmptyState icon={<BedDouble size={32} />} title="Sin alojamientos">
          Registra tus reservas o importa la confirmación de Booking, Airbnb o del hotel.
        </EmptyState>
      ) : (
        <div className="space-y-3">
          {b.lodgings.map((l) => {
            const nights = nightsBetween(l.checkInDate, l.checkOutDate);
            const dest = destinationName(b, l.destinationId);
            const suggested = !l.destinationId ? suggestDestination(b.destinations, l.city, l.checkInDate) : null;
            return (
              <Card key={l.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{l.name}</h3>
                      <Badge>{LODGING_TYPE[l.type]}</Badge>
                      <Badge tone={BOOKING_TONE[l.bookingStatus]}>{BOOKING_STATUS[l.bookingStatus]}</Badge>
                    </div>
                    <p className="mt-0.5 flex items-center gap-1 text-sm text-muted">
                      <MapPin size={13} />
                      {[l.address, l.city, l.country].filter(Boolean).join(", ") || "Sin dirección"}
                      {hasCoords(l) && (
                        <a href={googleMapsSearchUrl(l)} target="_blank" rel="noreferrer" className="ml-1 inline-flex items-center gap-0.5 text-accent hover:underline">
                          Maps <ExternalLink size={11} />
                        </a>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {l.priceMinor !== null && !hasExpense(b, "lodging", l.id) && (
                      <ExpenseDialog
                        mode="fromBooking"
                        label="Registrar gasto"
                        action={saveExpense.bind(null, tripId, null)}
                        {...expenseFormBase(b, rates)}
                        prefill={{
                          description: l.name,
                          category: "alojamiento",
                          amountMinor: l.priceMinor,
                          currency: l.currency ?? base,
                          destinationId: l.destinationId ?? undefined,
                          sourceType: "lodging",
                          sourceId: l.id,
                        }}
                      />
                    )}
                    <RecordDialog entity="lodging" mode="edit" action={saveEntity.bind(null, "lodging", tripId, l.id, null)} initial={l} context={ctx} />
                    <DeleteButton itemName={l.name} action={deleteEntity.bind(null, "lodging", tripId, l.id, null)} />
                  </div>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Detail label="Check-in">{l.checkInDate ? `${formatDate(l.checkInDate, "EEE d MMM")}${l.checkInTime ? ` · ${l.checkInTime}` : ""}` : null}</Detail>
                  <Detail label="Check-out">{l.checkOutDate ? `${formatDate(l.checkOutDate, "EEE d MMM")}${l.checkOutTime ? ` · ${l.checkOutTime}` : ""}` : null}</Detail>
                  <Detail label="Noches">{nights}</Detail>
                  <Detail label="Precio total">
                    {l.priceMinor !== null ? `${formatMoney(l.priceMinor, l.currency ?? base)}${nights ? ` (${formatMoney(Math.round(l.priceMinor / nights), l.currency ?? base)}/noche)` : ""}` : null}
                  </Detail>
                  <Detail label="Destino">{dest ?? (suggested ? `${suggested.city} (sugerido)` : null)}</Detail>
                  <Detail label="Plataforma">{l.platform}</Detail>
                  <Detail label="Código de reserva">{l.bookingCode && <Sensitive value={l.bookingCode} />}</Detail>
                  <Detail label="Huéspedes">{l.guests}</Detail>
                  <Detail label="Titular">{l.holderName}</Detail>
                  <Detail label="Impuestos">{l.taxesMinor !== null ? formatMoney(l.taxesMinor, l.currency ?? base) : null}</Detail>
                  <Detail label="Contacto">{l.hostContact}</Detail>
                  <Detail label="Acceso">{l.accessInfo && <Sensitive value={l.accessInfo} />}</Detail>
                </dl>
                {(l.cancellationPolicy || l.amenities || l.notes || l.bookingUrl) && (
                  <div className="mt-3 space-y-1 border-t border-line pt-3 text-sm">
                    {l.cancellationPolicy && <p><span className="text-muted">Cancelación: </span>{l.cancellationPolicy}</p>}
                    {l.amenities && <p><span className="text-muted">Servicios: </span>{l.amenities}</p>}
                    {l.notes && <p className="text-muted">{l.notes}</p>}
                    {l.bookingUrl && (
                      <a href={l.bookingUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline">
                        Ver reserva <ExternalLink size={12} />
                      </a>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
