import { useSearchParams } from "react-router";
import { useTrip } from "@/pages/trip/context";
import { Clock, ExternalLink, MapPin, Ticket } from "lucide-react";
import { Link } from "react-router";
import { deleteEntity, saveEntity, saveExpense } from "@/lib/api";
import { DeleteButton } from "@/components/delete-button";
import { ExpenseDialog } from "@/components/expense-form";
import { RecordDialog } from "@/components/record-dialog";
import { Badge, BOOKING_TONE, Card, cx, EmptyState, PageHeader } from "@/components/ui";
import { overlappingActivities } from "@/lib/domain/alerts";
import { formatDayHeading } from "@/lib/domain/dates";
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
  for (const a of list) groups.set(a.date ?? "", [...(groups.get(a.date ?? "") ?? []), a]);
  const ordered = [...groups.entries()].sort(([a], [b]) => (a === "" ? 1 : b === "" ? -1 : a.localeCompare(b)));
  const href = (q: Record<string, string | undefined>) => {
    const p = new URLSearchParams(Object.entries({ categoria, destino, ...q }).filter(([, v]) => v) as [string, string][]);
    return `/trips/${tripId}/activities${p.size ? `?${p}` : ""}`;
  };
  const usedCategories = [...new Set(b.activities.map((a) => a.category))];

  return (
    <div>
      <PageHeader
        title="Actividades"
        subtitle="Itinerario cronológico. Se avisan las actividades superpuestas y las que requieren reserva."
        actions={<RecordDialog entity="activity" action={saveEntity.bind(null, "activity", tripId, null, null)} context={ctx} />}
      />
      {b.activities.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2 text-sm">
          <FilterLink href={href({ categoria: undefined })} active={!categoria}>Todas</FilterLink>
          {usedCategories.map((c) => (
            <FilterLink key={c} href={href({ categoria: c })} active={categoria === c}>{ACTIVITY_CATEGORY[c]}</FilterLink>
          ))}
          {b.destinations.length > 1 && (
            <>
              <span className="mx-1 self-center text-line">|</span>
              <FilterLink href={href({ destino: undefined })} active={!destino}>Todas las ciudades</FilterLink>
              {b.destinations.map((d) => (
                <FilterLink key={d.id} href={href({ destino: d.id })} active={destino === d.id}>{d.city}</FilterLink>
              ))}
            </>
          )}
        </div>
      )}
      {b.activities.length === 0 ? (
        <EmptyState icon={<Ticket size={32} />} title="Sin actividades">
          Planifica museos, excursiones, eventos o paseos y organízalos por día.
        </EmptyState>
      ) : list.length === 0 ? (
        <Card className="p-4 text-sm text-muted">Ninguna actividad coincide con el filtro.</Card>
      ) : (
        <div className="space-y-6">
          {ordered.map(([date, items]) => (
            <section key={date || "sin-fecha"}>
              <h2 className="mb-2 text-sm font-semibold capitalize">{date ? formatDayHeading(date) : "Sin fecha asignada"}</h2>
              <div className="space-y-2">
                {items.map((a) => (
                  <Card key={a.id} className={cx("p-4", conflicts.has(a.id) && "border-warning")}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
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

function FilterLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link to={href} className={cx("rounded-full border px-3 py-1", active ? "border-accent bg-accent-soft text-accent" : "border-line text-muted hover:text-ink")}>
      {children}
    </Link>
  );
}
