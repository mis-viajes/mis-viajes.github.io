import { useTrip } from "@/pages/trip/context";
import { Briefcase, Luggage, Plane, PlaneLanding, PlaneTakeoff, ShoppingBag } from "lucide-react";
import { deleteEntity, saveEntity, saveExpense } from "@/lib/api";
import { DeleteButton } from "@/components/delete-button";
import { ExpenseDialog } from "@/components/expense-form";
import { RecordDialog } from "@/components/record-dialog";
import { Sensitive } from "@/components/sensitive";
import { Badge, BOOKING_TONE, Card, Detail, EmptyState, PageHeader, SectionTitle } from "@/components/ui";
import { formatDateTimeLocal, formatDuration } from "@/lib/domain/dates";
import { formatMoney } from "@/lib/domain/money";
import { findConnections, flightSegment, segmentDuration, transportSegment } from "@/lib/domain/segments";
import type { FlightWithBaggage } from "@/lib/domain/types";
import { BAGGAGE_CATEGORY, BOOKING_STATUS, FLIGHT_DIRECTION } from "@/lib/labels";
import { expenseFormBase, formContext, hasExpense } from "@/lib/trip-helpers";

const BAG_ICON = { personal: ShoppingBag, cabina: Briefcase, facturado: Luggage, adicional: Luggage };

export default function FlightsPage() {
  const { b, tripId, rates } = useTrip();
  const ctx = formContext(b);
  const base = b.trip.baseCurrency;
  const connections = findConnections([...b.flights.map(flightSegment), ...b.transports.map(transportSegment)]);
  const active = b.flights.filter((f) => f.bookingStatus !== "cancelado");

  return (
    <div className="space-y-8">
      <PageHeader
        title="Vuelos y equipaje"
        subtitle="Cada vuelo guarda su propia franquicia de equipaje, porque cada aerolínea tiene reglas distintas."
        actions={<RecordDialog entity="flight" action={saveEntity.bind(null, "flight", tripId, null, null)} context={ctx} />}
      />

      {b.flights.length === 0 ? (
        <EmptyState icon={<Plane size={32} />} title="Sin vuelos registrados">
          Añade tus vuelos manualmente o impórtalos desde la confirmación de la aerolínea en la pestaña Importar.
        </EmptyState>
      ) : (
        <>
          {active.length > 0 && <BaggageSummary flights={active} />}
          <div className="space-y-3">
            {b.flights.map((f) => {
              const seg = flightSegment(f);
              const duration = segmentDuration(seg);
              const conn = connections.find((c) => c.to.id === f.id && c.from.kind === "flight");
              return (
                <div key={f.id}>
                  {conn && (
                    <p className={`mb-2 ml-4 text-xs ${conn.tight ? "font-medium text-warning" : "text-muted"}`}>
                      ↳ Conexión de {formatDuration(conn.gapMinutes)} {conn.tight && `(se recomiendan ${formatDuration(conn.minimum)})`}
                    </p>
                  )}
                  <Card className="p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="accent">{FLIGHT_DIRECTION[f.direction]}</Badge>
                        <span className="font-semibold">{[f.airline, f.flightNumber].filter(Boolean).join(" ") || "Vuelo"}</span>
                        <Badge tone={BOOKING_TONE[f.bookingStatus]}>{BOOKING_STATUS[f.bookingStatus]}</Badge>
                      </div>
                      <div className="flex items-center gap-1">
                        {f.priceMinor !== null && !hasExpense(b, "flight", f.id) && (
                          <ExpenseDialog
                            mode="fromBooking"
                            label="Registrar gasto"
                            action={saveExpense.bind(null, tripId, null)}
                            {...expenseFormBase(b, rates)}
                            prefill={{
                              description: `Vuelo ${[f.airline, f.flightNumber].filter(Boolean).join(" ")} ${f.originCode ?? ""}→${f.destinationCode ?? ""}`.trim(),
                              category: "vuelos",
                              amountMinor: f.priceMinor,
                              currency: f.currency ?? base,
                              sourceType: "flight",
                              sourceId: f.id,
                            }}
                          />
                        )}
                        <RecordDialog entity="flight" mode="edit" action={saveEntity.bind(null, "flight", tripId, f.id, null)} initial={f} context={ctx} />
                        <DeleteButton itemName={`el vuelo ${f.flightNumber ?? ""}`.trim()} action={deleteEntity.bind(null, "flight", tripId, f.id, null)} />
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                      <div>
                        <p className="flex items-center gap-1.5 text-2xl font-semibold tracking-tight">
                          <PlaneTakeoff size={18} className="text-muted" /> {f.originCode ?? "—"}
                        </p>
                        <p className="truncate text-xs text-muted">{f.originName}</p>
                        <p className="text-sm">{formatDateTimeLocal(f.departureLocal)}</p>
                        {f.terminalOrigin && <p className="text-xs text-muted">Terminal {f.terminalOrigin}</p>}
                      </div>
                      <div className="text-center text-xs text-muted">
                        <Plane size={16} className="mx-auto mb-0.5 text-accent" />
                        {duration !== null ? (seg.exact ? formatDuration(duration) : "Falta zona horaria") : ""}
                      </div>
                      <div className="text-right">
                        <p className="flex items-center justify-end gap-1.5 text-2xl font-semibold tracking-tight">
                          {f.destinationCode ?? "—"} <PlaneLanding size={18} className="text-muted" />
                        </p>
                        <p className="truncate text-xs text-muted">{f.destinationName}</p>
                        <p className="text-sm">{formatDateTimeLocal(f.arrivalLocal)}</p>
                        {f.terminalDestination && <p className="text-xs text-muted">Terminal {f.terminalDestination}</p>}
                      </div>
                    </div>

                    <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-line pt-3 sm:grid-cols-4">
                      <Detail label="Reserva (PNR)">{f.bookingCode && <Sensitive value={f.bookingCode} />}</Detail>
                      <Detail label="Asientos">{f.seats}</Detail>
                      <Detail label="Clase">{f.cabinClass}</Detail>
                      <Detail label="Precio">{f.priceMinor !== null ? formatMoney(f.priceMinor, f.currency ?? base) : null}</Detail>
                    </dl>

                    <div className="mt-3 rounded-lg bg-surface-2 p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="text-sm font-medium">Equipaje de este vuelo</p>
                        <RecordDialog
                          entity="baggage"
                          action={saveEntity.bind(null, "baggage", tripId, null, f.id)}
                          context={{ ...ctx, baseCurrency: f.currency ?? base }}
                          variant="ghost"
                          label="Añadir"
                        />
                      </div>
                      {f.baggage.length === 0 ? (
                        <p className="text-sm text-warning">Sin información de equipaje. Consulta las condiciones de tu tarifa y regístralas aquí.</p>
                      ) : (
                        <ul className="space-y-1.5">
                          {f.baggage.map((bag) => {
                            const Icon = BAG_ICON[bag.category];
                            return (
                              <li key={bag.id} className="flex items-start gap-2 text-sm">
                                <Icon size={15} className="mt-0.5 shrink-0 text-muted" />
                                <span className="min-w-0 flex-1">
                                  <span className="font-medium">{BAGGAGE_CATEGORY[bag.category]}</span>
                                  <span className="text-muted">
                                    {" · "}
                                    {[
                                      bag.quantity !== null ? `${bag.quantity} ${bag.quantity === 1 ? "pieza" : "piezas"}` : null,
                                      bag.maxWeightKg !== null ? `máx. ${bag.maxWeightKg} kg` : null,
                                      bag.maxDimensions,
                                      bag.extraCostMinor !== null ? `adicional ${formatMoney(bag.extraCostMinor, bag.currency ?? f.currency ?? base)}` : null,
                                    ]
                                      .filter(Boolean)
                                      .join(" · ") || "sin detalles"}
                                  </span>
                                  {bag.restrictions && <span className="block text-xs text-muted">{bag.restrictions}</span>}
                                </span>
                                <RecordDialog
                                  entity="baggage"
                                  mode="edit"
                                  action={saveEntity.bind(null, "baggage", tripId, bag.id, f.id)}
                                  initial={bag}
                                  context={{ ...ctx, baseCurrency: f.currency ?? base }}
                                />
                                <DeleteButton itemName={BAGGAGE_CATEGORY[bag.category].toLowerCase()} action={deleteEntity.bind(null, "baggage", tripId, bag.id, f.id)} />
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                    {f.notes && <p className="mt-2 text-sm text-muted">{f.notes}</p>}
                  </Card>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Comprueba qué equipaje sirve para TODO el itinerario: para cada tipo, la condición
 * más restrictiva entre los vuelos que la informan, y qué vuelos no la incluyen.
 */
function BaggageSummary({ flights }: { flights: FlightWithBaggage[] }) {
  const categories = ["personal", "cabina", "facturado"] as const;
  const label = (f: FlightWithBaggage) => [f.airline, f.flightNumber].filter(Boolean).join(" ") || `${f.originCode ?? "?"}→${f.destinationCode ?? "?"}`;
  const rows = categories.map((cat) => {
    const of = (f: FlightWithBaggage) => f.baggage.filter((b) => b.category === cat);
    // Incluido: hay franquicia con cantidad > 0 (o sin cantidad indicada). No incluido: cantidad 0 explícita.
    const included = flights.filter((f) => of(f).some((b) => b.quantity === null || b.quantity > 0));
    const notIncluded = flights.filter((f) => of(f).length > 0 && of(f).every((b) => b.quantity === 0));
    const unknown = flights.filter((f) => of(f).length === 0);
    const allowances = included.flatMap(of);
    const weights = allowances.map((a) => a.maxWeightKg).filter((w): w is number => w !== null);
    const quantities = allowances.map((a) => a.quantity).filter((q): q is number => q !== null);
    return {
      cat,
      included: included.length,
      minWeight: weights.length ? Math.min(...weights) : null,
      minQty: quantities.length ? Math.min(...quantities) : null,
      dimensions: [...new Set(allowances.map((a) => a.maxDimensions).filter(Boolean))],
      notIncluded,
      unknown,
    };
  });

  return (
    <section>
      <SectionTitle title="¿Qué equipaje puedo llevar en todo el viaje?" subtitle="Se usa la condición más restrictiva de todos los vuelos activos." />
      <div className="grid gap-3 md:grid-cols-3">
        {rows.map((r) => {
          const Icon = BAG_ICON[r.cat];
          const ok = r.included === flights.length;
          const noData = r.unknown.length === flights.length;
          return (
            <Card key={r.cat} className="p-4">
              <div className="flex items-center gap-2">
                <Icon size={17} className={ok ? "text-success" : noData ? "text-muted" : "text-warning"} />
                <p className="font-medium">{BAGGAGE_CATEGORY[r.cat]}</p>
              </div>
              <p className="mt-1 text-sm">
                {ok
                  ? "Incluido en todos los vuelos"
                  : noData
                    ? "Sin información registrada"
                    : `Incluido en ${r.included} de ${flights.length} vuelos`}
              </p>
              {(r.minQty !== null || r.minWeight !== null) && (
                <p className="text-sm text-muted">
                  {[r.minQty !== null ? `${r.minQty} ${r.minQty === 1 ? "pieza" : "piezas"}` : null, r.minWeight !== null ? `máx. ${r.minWeight} kg` : null].filter(Boolean).join(" · ")}
                </p>
              )}
              {r.dimensions.length > 0 && <p className="text-xs text-muted">Dimensiones: {r.dimensions.join(" / ")}</p>}
              {r.notIncluded.length > 0 && (
                <p className="mt-1 text-xs text-warning">No incluido en: {r.notIncluded.map(label).join(", ")}</p>
              )}
              {r.unknown.length > 0 && !noData && <p className="mt-1 text-xs text-muted">Sin datos: {r.unknown.map(label).join(", ")}</p>}
            </Card>
          );
        })}
      </div>
    </section>
  );
}
