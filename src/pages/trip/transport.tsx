import { useTrip } from "@/pages/trip/context";
import { ArrowRight, TrainFront } from "lucide-react";
import { deleteEntity, saveEntity, saveExpense } from "@/lib/api";
import { DeleteButton } from "@/components/delete-button";
import { ExpenseDialog } from "@/components/expense-form";
import { RecordDialog } from "@/components/record-dialog";
import { Sensitive } from "@/components/sensitive";
import { Badge, BOOKING_TONE, Card, Detail, EmptyState, PageHeader } from "@/components/ui";
import { formatDateTimeLocal, formatDuration, timePart } from "@/lib/domain/dates";
import { estimateMinutes, formatKm, hasCoords, haversineKm } from "@/lib/domain/geo";
import { formatMoney } from "@/lib/domain/money";
import { findConnections, flightSegment, segmentDuration, transportSegment } from "@/lib/domain/segments";
import { BOOKING_STATUS, TRANSPORT_TYPE } from "@/lib/labels";
import { expenseFormBase, formContext, hasExpense } from "@/lib/trip-helpers";

export default function TransportPage() {
  const { b, tripId, rates } = useTrip();
  const ctx = formContext(b);
  const base = b.trip.baseCurrency;
  const connections = findConnections([...b.flights.map(flightSegment), ...b.transports.map(transportSegment)]);

  return (
    <div>
      <PageHeader
        title="Transporte terrestre"
        subtitle="Trenes, autobuses, traslados, alquiler de coche, ferris y más."
        actions={<RecordDialog entity="transport" action={saveEntity.bind(null, "transport", tripId, null, null)} context={ctx} />}
      />
      {b.transports.length === 0 ? (
        <EmptyState icon={<TrainFront size={32} />} title="Sin trayectos registrados">
          Añade trenes, buses o traslados aeropuerto-hotel. Se comprobará que las conexiones con tus vuelos no estén demasiado ajustadas.
        </EmptyState>
      ) : (
        <div className="space-y-3">
          {b.transports.map((t) => {
            const seg = transportSegment(t);
            const duration = segmentDuration(seg);
            const conn = connections.find((c) => c.to.id === t.id);
            const origin = { lat: t.originLat, lng: t.originLng };
            const dest = { lat: t.destinationLat, lng: t.destinationLng };
            const km = hasCoords(origin) && hasCoords(dest) ? haversineKm(origin, dest) : null;
            return (
              <div key={t.id}>
                {conn && (
                  <p className={`mb-2 ml-4 text-xs ${conn.tight ? "font-medium text-warning" : "text-muted"}`}>
                    ↳ {formatDuration(conn.gapMinutes)} desde {conn.from.label} {conn.tight && `(se recomiendan ${formatDuration(conn.minimum)})`}
                  </p>
                )}
                <Card className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="accent">{TRANSPORT_TYPE[t.type]}</Badge>
                      <span className="font-semibold">{[t.operator, t.serviceNumber].filter(Boolean).join(" ") || TRANSPORT_TYPE[t.type]}</span>
                      <Badge tone={BOOKING_TONE[t.bookingStatus]}>{BOOKING_STATUS[t.bookingStatus]}</Badge>
                    </div>
                    <div className="flex items-center gap-1">
                      {t.priceMinor !== null && !hasExpense(b, "transport", t.id) && (
                        <ExpenseDialog
                          mode="fromBooking"
                          label="Registrar gasto"
                          action={saveExpense.bind(null, tripId, null)}
                          {...expenseFormBase(b, rates)}
                          prefill={{
                            description: `${TRANSPORT_TYPE[t.type]} ${t.origin ?? ""} → ${t.destination ?? ""}`.trim(),
                            category: "transporte",
                            amountMinor: t.priceMinor,
                            currency: t.currency ?? base,
                            sourceType: "transport",
                            sourceId: t.id,
                          }}
                        />
                      )}
                      <RecordDialog entity="transport" mode="edit" action={saveEntity.bind(null, "transport", tripId, t.id, null)} initial={t} context={ctx} />
                      <DeleteButton itemName={`el trayecto ${t.origin ?? ""} → ${t.destination ?? ""}`} action={deleteEntity.bind(null, "transport", tripId, t.id, null)} />
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                    <div>
                      <p className="font-medium">{t.origin ?? "—"}</p>
                      <p className="text-muted">{formatDateTimeLocal(t.departureLocal)}</p>
                    </div>
                    <div className="flex flex-col items-center text-xs text-muted">
                      <ArrowRight size={16} className="text-accent" />
                      {duration !== null && formatDuration(duration)}
                    </div>
                    <div>
                      <p className="font-medium">{t.destination ?? "—"}</p>
                      <p className="text-muted">{timePart(t.arrivalLocal) ? formatDateTimeLocal(t.arrivalLocal) : "—"}</p>
                    </div>
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-line pt-3 sm:grid-cols-4">
                    <Detail label="Reserva">{t.bookingCode && <Sensitive value={t.bookingCode} />}</Detail>
                    <Detail label="Asiento">{t.seat}</Detail>
                    <Detail label="Clase">{t.travelClass}</Detail>
                    <Detail label="Precio">{t.priceMinor !== null ? formatMoney(t.priceMinor, t.currency ?? base) : null}</Detail>
                    <Detail label="Equipaje">{t.baggageInfo}</Detail>
                    <Detail label="Distancia (línea recta)">{km !== null ? formatKm(km) : null}</Detail>
                    {km !== null && duration === null && <Detail label="Tiempo estimado en coche">~{formatDuration(estimateMinutes(km, "driving"))}</Detail>}
                  </dl>
                  {t.directionsInfo && (
                    <p className="mt-3 rounded-lg bg-surface-2 px-3 py-2 text-sm">
                      <span className="font-medium">Cómo llegar: </span>
                      {t.directionsInfo}
                    </p>
                  )}
                  {t.notes && <p className="mt-2 text-sm text-muted">{t.notes}</p>}
                </Card>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
