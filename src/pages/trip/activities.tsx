import { useSearchParams } from "react-router";
import { useTrip } from "@/pages/trip/context";
import { Clock, ExternalLink, GripVertical, MapPin, Ticket } from "lucide-react";
import { useState, type DragEvent } from "react";
import { deleteEntity, moveActivity, saveEntity, saveExpense } from "@/lib/api";
import { DeleteButton } from "@/components/delete-button";
import { ExpenseDialog } from "@/components/expense-form";
import { RecordDialog } from "@/components/record-dialog";
import { Badge, BOOKING_TONE, Card, cx, EmptyState, FilterChip, PageHeader } from "@/components/ui";
import { overlappingActivities } from "@/lib/domain/alerts";
import { formatDayHeading } from "@/lib/domain/dates";
import { compareActivities } from "@/lib/domain/itinerary";
import { formatMoney } from "@/lib/domain/money";
import type { Activity } from "@/lib/types";
import { ACTIVITY_CATEGORY, BOOKING_STATUS } from "@/lib/labels";
import { destinationName, expenseFormBase, formContext, hasExpense } from "@/lib/trip-helpers";

export default function ActivitiesPage() {
  const { b, tripId, rates } = useTrip();
  const [searchParams] = useSearchParams();
  const categoria = searchParams.get("categoria") ?? undefined;
  const destino = searchParams.get("destino") ?? undefined;
  const ctx = formContext(b);
  const base = b.trip.baseCurrency;

  const conflicts = new Set(overlappingActivities(b).flatMap(([x, y]) => [x.id, y.id]));
  const list = b.activities.filter(
    (a) => (!categoria || a.category === categoria) && (!destino || a.destinationId === destino),
  );
  const groups = new Map<string, Activity[]>();
  for (const a of [...list].sort(compareActivities)) groups.set(a.date ?? "", [...(groups.get(a.date ?? "") ?? []), a]);
  const ordered = [...groups.entries()].sort(([a], [b]) => (a === "" ? 1 : b === "" ? -1 : a.localeCompare(b)));
  const href = (q: Record<string, string | undefined>) => {
    const p = new URLSearchParams(Object.entries({ categoria, destino, ...q }).filter(([, v]) => v) as [string, string][]);
    return `/trips/${tripId}/activities${p.size ? `?${p}` : ""}`;
  };
  const usedCategories = [...new Set(b.activities.map((a) => a.category))];
  const [error, setError] = useState<string | null>(null);

  /** Suelta una actividad en un día; con `before`, justo antes de esa actividad. */
  const drop = async (e: DragEvent, date: string, items: Activity[], before?: string) => {
    e.preventDefault();
    e.stopPropagation();
    const id = e.dataTransfer.getData("text/activity");
    if (!id || id === before) return;
    const ids = items.map((a) => a.id).filter((a) => a !== id);
    ids.splice(before ? ids.indexOf(before) : ids.length, 0, id);
    setError(null);
    try {
      await moveActivity(tripId, id, date || null, ids);
    } catch {
      setError("No se pudo mover la actividad. Revisa tu conexión; si persiste, falta ejecutar supabase/schema.sql.");
    }
  };

  return (
    <div>
      <PageHeader
        title="Actividades"
        subtitle="Itinerario cronológico. Arrastra para cambiar de día u ordenar las actividades sin hora."
        actions={<RecordDialog entity="activity" action={saveEntity.bind(null, "activity", tripId, null, null)} context={ctx} />}
      />
      {b.activities.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2 text-sm">
          <FilterChip href={href({ categoria: undefined })} active={!categoria}>Todas</FilterChip>
          {usedCategories.map((c) => (
            <FilterChip key={c} href={href({ categoria: c })} active={categoria === c}>{ACTIVITY_CATEGORY[c]}</FilterChip>
          ))}
          {b.destinations.length > 1 && (
            <>
              <span className="mx-1 self-center text-line">|</span>
              <FilterChip href={href({ destino: undefined })} active={!destino}>Todas las ciudades</FilterChip>
              {b.destinations.map((d) => (
                <FilterChip key={d.id} href={href({ destino: d.id })} active={destino === d.id}>{d.city}</FilterChip>
              ))}
            </>
          )}
        </div>
      )}
      {error && <p className="mb-3 text-sm text-danger">{error}</p>}
      {b.activities.length === 0 ? (
        <EmptyState icon={<Ticket size={32} />} title="Sin actividades">
          Planifica museos, excursiones, eventos o paseos y organízalos por día.
        </EmptyState>
      ) : list.length === 0 ? (
        <Card className="p-4 text-sm text-muted">Ninguna actividad coincide con el filtro.</Card>
      ) : (
        <div className="space-y-6">
          {ordered.map(([date, items]) => (
            <section key={date || "sin-fecha"} onDragOver={(e) => e.preventDefault()} onDrop={(e) => drop(e, date, items)}>
              <h2 className="mb-2 text-sm font-semibold capitalize">{date ? formatDayHeading(date) : "Sin fecha asignada"}</h2>
              <div className="space-y-2">
                {items.map((a) => (
                  <Card
                    key={a.id}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData("text/activity", a.id)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => drop(e, date, items, a.id)}
                    className={cx("p-4", conflicts.has(a.id) && "border-warning")}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex min-w-0 gap-2">
                        <GripVertical size={16} className="mt-0.5 shrink-0 cursor-grab text-muted" aria-hidden />
                        <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-medium">{a.name}</h3>
                          <Badge>{ACTIVITY_CATEGORY[a.category]}</Badge>
                          {a.requiresBooking && <Badge tone={BOOKING_TONE[a.bookingStatus]}>{BOOKING_STATUS[a.bookingStatus]}</Badge>}
                          {conflicts.has(a.id) && <Badge tone="warning">Horario superpuesto</Badge>}
                        </div>
                        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-muted">
                          {a.startTime && (
                            <span className="flex items-center gap-1">
                              <Clock size={13} /> {a.startTime}
                              {a.endTime && `–${a.endTime}`}
                            </span>
                          )}
                          {(a.city || destinationName(b, a.destinationId)) && (
                            <span className="flex items-center gap-1">
                              <MapPin size={13} /> {[a.address, a.city ?? destinationName(b, a.destinationId)].filter(Boolean).join(", ")}
                            </span>
                          )}
                          {a.priceMinor !== null && <span>{formatMoney(a.priceMinor, a.currency ?? base)}</span>}
                        </p>
                        {a.description && <p className="mt-1 text-sm">{a.description}</p>}
                        {a.notes && <p className="mt-1 text-sm text-muted">{a.notes}</p>}
                        {a.bookingUrl && (
                          <a href={a.bookingUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-sm text-accent hover:underline">
                            Comprar / reservar <ExternalLink size={12} />
                          </a>
                        )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {a.priceMinor !== null && a.priceMinor > 0 && !hasExpense(b, "activity", a.id) && (
                          <ExpenseDialog
                            mode="fromBooking"
                            label="Registrar gasto"
                            action={saveExpense.bind(null, tripId, null)}
                            {...expenseFormBase(b, rates)}
                            prefill={{ description: a.name, category: "actividades", amountMinor: a.priceMinor, currency: a.currency ?? base, date: a.date ?? undefined, destinationId: a.destinationId ?? undefined, sourceType: "activity", sourceId: a.id }}
                          />
                        )}
                        <RecordDialog entity="activity" mode="edit" action={saveEntity.bind(null, "activity", tripId, a.id, null)} initial={a} context={ctx} />
                        <DeleteButton itemName={a.name} action={deleteEntity.bind(null, "activity", tripId, a.id, null)} />
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
