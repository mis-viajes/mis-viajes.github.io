import { Check, Database, ListChecks, Luggage, Sparkles } from "lucide-react";
import { useState } from "react";
import { useSearchParams } from "react-router";
import { DeleteButton } from "@/components/delete-button";
import { Modal } from "@/components/modal";
import { RecordDialog } from "@/components/record-dialog";
import { Badge, buttonStyles, Card, cx, EmptyState, FilterChip, PageHeader, ProgressBar, SectionTitle, type Tone } from "@/components/ui";
import { addChecklistItems, deleteEntity, saveEntity, setChecklistStatus } from "@/lib/api";
import { packingCheck, sortChecklist, suggestItems, type Suggestion } from "@/lib/domain/checklist";
import { daysUntil, formatDate, todayISO } from "@/lib/domain/dates";
import type { TripBundle } from "@/lib/domain/types";
import { BAGGAGE_CATEGORY, CHECKLIST_PRIORITY } from "@/lib/labels";
import { formContext } from "@/lib/trip-helpers";
import type { ChecklistItem } from "@/lib/types";
import { useTrip } from "@/pages/trip/context";

const PRIORITY_TONE: Record<string, Tone> = { alta: "danger", media: "neutral", baja: "neutral" };

export default function ChecklistPage() {
  const { b, tripId } = useTrip();
  const [searchParams] = useSearchParams();
  const list = searchParams.get("lista") === "maleta" ? "maleta" : "tareas";
  const [error, setError] = useState<string | null>(null);

  if (!b.checklistAvailable) return <NeedsSchema />;

  const entity = list === "tareas" ? "task" : "packingItem";
  const ctx = formContext(b);
  const items = b.checklist.filter((c) => c.list === list);
  const done = items.filter((c) => c.status === "hecho").length;
  const groups = new Map<string, ChecklistItem[]>();
  for (const item of sortChecklist(items)) {
    const group = item.groupName ?? "Sin categoría";
    groups.set(group, [...(groups.get(group) ?? []), item]);
  }
  const count = (l: ChecklistItem["list"]) => b.checklist.filter((c) => c.list === l && c.status !== "hecho").length;

  return (
    <div>
      <PageHeader
        title="Checklist"
        subtitle="Lo que falta por hacer y lo que va en la maleta."
        actions={
          <>
            <Suggestions key={list} b={b} tripId={tripId} list={list} />
            <RecordDialog entity={entity} action={saveEntity.bind(null, entity, tripId, null, null)} context={ctx} />
          </>
        }
      />
      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        <FilterChip href={`/trips/${tripId}/checklist`} active={list === "tareas"}>Tareas ({count("tareas")})</FilterChip>
        <FilterChip href={`/trips/${tripId}/checklist?lista=maleta`} active={list === "maleta"}>Maleta ({count("maleta")})</FilterChip>
      </div>
      {error && <p className="mb-3 text-sm text-danger">{error}</p>}
      {items.length > 0 && (
        <div className="mb-5">
          <p className="mb-1 text-sm text-muted">{done} de {items.length} {list === "tareas" ? "hechas" : "listos"}</p>
          <ProgressBar value={done} max={items.length} />
        </div>
      )}
      {list === "maleta" && <PackingSummary b={b} />}
      {items.length === 0 ? (
        <EmptyState icon={list === "tareas" ? <ListChecks size={32} /> : <Luggage size={32} />} title={list === "tareas" ? "Sin tareas" : "La maleta está vacía"}>
          {list === "tareas"
            ? "Agrega lo que debes hacer antes de salir o usa las sugerencias, que incluyen lo que aún falta reservar."
            : "Agrega lo que vas a llevar. Si indicas el peso, se compara con el límite de tus vuelos."}
        </EmptyState>
      ) : (
        <div className="space-y-5">
          {[...groups.entries()].map(([group, rows]) => (
            <section key={group}>
              <h2 className="mb-1.5 text-sm font-semibold">{group}</h2>
              <Card className="divide-y divide-line">
                {rows.map((item) => (
                  <Row key={item.id} item={item} tripId={tripId} ctx={ctx} onError={setError} />
                ))}
              </Card>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function Row({ item, tripId, ctx, onError }: { item: ChecklistItem; tripId: string; ctx: ReturnType<typeof formContext>; onError: (msg: string | null) => void }) {
  const [pending, setPending] = useState(false);
  const entity = item.list === "tareas" ? "task" : "packingItem";
  const done = item.status === "hecho";
  const days = item.dueDate ? daysUntil(item.dueDate, todayISO()) : null;

  const toggle = async () => {
    setPending(true);
    onError(null);
    try {
      await setChecklistStatus(tripId, item.id, done ? "pendiente" : "hecho");
    } catch {
      onError("No se pudo guardar. Sin conexión la checklist es de solo lectura.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex items-center gap-3 px-3 py-2">
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={item.title}
        disabled={pending}
        onClick={toggle}
        className={cx("grid h-6 w-6 shrink-0 place-items-center rounded-md border transition", done ? "border-accent bg-accent text-accent-ink" : "border-line hover:border-accent")}
      >
        {done && <Check size={15} />}
      </button>
      <div className="min-w-0 flex-1">
        <p className={cx("text-sm", done && "text-muted line-through")}>
          {item.title}
          {item.quantity !== null && item.quantity > 1 && <span className="text-muted"> × {item.quantity}</span>}
        </p>
        <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
          {item.bag && <span>{BAGGAGE_CATEGORY[item.bag]}</span>}
          {item.weightKg !== null && <span>{item.weightKg} kg c/u</span>}
          {item.notes && <span className="truncate">{item.notes}</span>}
        </p>
      </div>
      {item.status === "en_curso" && <Badge tone="info">En curso</Badge>}
      {!done && item.list === "tareas" && item.priority === "alta" && <Badge tone={PRIORITY_TONE.alta}>{CHECKLIST_PRIORITY.alta}</Badge>}
      {!done && days !== null && (
        <Badge tone={days < 0 ? "danger" : days <= 3 ? "warning" : "neutral"}>{days < 0 ? "Vencida" : formatDate(item.dueDate, "d MMM")}</Badge>
      )}
      <RecordDialog entity={entity} mode="edit" action={saveEntity.bind(null, entity, tripId, item.id, null)} initial={item} context={ctx} />
      <DeleteButton itemName={item.title} action={deleteEntity.bind(null, entity, tripId, item.id, null)} />
    </div>
  );
}

function PackingSummary({ b }: { b: TripBundle }) {
  const checks = packingCheck(b.checklist, b.flights);
  if (checks.length === 0) return null;
  return (
    <section className="mb-5">
      <SectionTitle title="¿Cumple con tus vuelos?" subtitle="Se compara con el límite más restrictivo de todos los vuelos activos." />
      <div className="grid gap-3 md:grid-cols-3">
        {checks.map((c) => (
          <Card key={c.bag} className={cx("p-4", c.problem && "border-warning")}>
            <p className="font-medium">{BAGGAGE_CATEGORY[c.bag]}</p>
            <p className="mt-1 text-sm tabular-nums">
              {c.weightKg} kg{c.limitKg !== null ? ` de ${c.limitKg} kg` : ""}
            </p>
            {c.limitKg !== null && <ProgressBar value={c.weightKg} max={c.limitKg} tone={c.weightKg > c.limitKg ? "danger" : "accent"} />}
            {c.limitKg === null && <p className="text-xs text-muted">Los vuelos no indican un límite de peso.</p>}
            {c.withoutWeight > 0 && <p className="mt-1 text-xs text-muted">{c.withoutWeight} {c.withoutWeight === 1 ? "objeto" : "objetos"} sin peso: el total real es mayor.</p>}
            {c.problem && <p className="mt-1 text-xs text-warning">{c.problem}</p>}
          </Card>
        ))}
      </div>
    </section>
  );
}

function Suggestions({ b, tripId, list }: { b: TripBundle; tripId: string; list: ChecklistItem["list"] }) {
  const [open, setOpen] = useState(false);
  const [unchecked, setUnchecked] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const suggestions = suggestItems(b, list);
  if (suggestions.length === 0) return null;

  const groups = new Map<string, Suggestion[]>();
  for (const s of suggestions) groups.set(s.groupName ?? "", [...(groups.get(s.groupName ?? "") ?? []), s]);
  const chosen = suggestions.filter((s) => !unchecked.has(s.title));

  const add = async () => {
    setPending(true);
    setError(null);
    try {
      await addChecklistItems(tripId, chosen);
      setUnchecked(new Set());
      setOpen(false);
    } catch {
      setError("No se pudieron añadir. Revisa tu conexión.");
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <button type="button" className={buttonStyles.secondary} onClick={() => setOpen(true)}>
        <Sparkles size={16} /> Sugerencias
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Sugerencias" size="lg">
        <p className="mb-3 text-sm text-muted">
          {list === "tareas" ? "Tareas habituales y lo que este viaje aún tiene sin reservar." : "Lista base para empezar; luego ajústala a tu viaje."} Desmarca lo que no necesites.
        </p>
        <div className="space-y-4">
          {[...groups.entries()].map(([group, rows]) => (
            <fieldset key={group}>
              <legend className="mb-1 text-sm font-semibold">{group}</legend>
              {rows.map((s) => (
                <label key={s.title} className="flex items-center gap-2 py-1 text-sm">
                  <input
                    type="checkbox"
                    checked={!unchecked.has(s.title)}
                    onChange={(e) => {
                      const next = new Set(unchecked);
                      if (e.target.checked) next.delete(s.title);
                      else next.add(s.title);
                      setUnchecked(next);
                    }}
                  />
                  {s.title}
                </label>
              ))}
            </fieldset>
          ))}
        </div>
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className={buttonStyles.secondary} onClick={() => setOpen(false)}>Cancelar</button>
          <button type="button" className={buttonStyles.primary} disabled={pending || chosen.length === 0} onClick={add}>
            {pending ? "Añadiendo…" : `Añadir ${chosen.length}`}
          </button>
        </div>
      </Modal>
    </>
  );
}

function NeedsSchema() {
  return (
    <Card className="mx-auto max-w-2xl p-6">
      <p className="flex items-center gap-2 text-lg font-semibold">
        <Database size={20} className="text-accent" /> Falta actualizar la base de datos
      </p>
      <p className="mt-2 text-sm text-muted">La checklist necesita una tabla nueva. El resto de la app funciona igual y no se pierde ningún dato.</p>
      <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm">
        <li>Abre tu proyecto en supabase.com → <strong>SQL Editor</strong> → <strong>New query</strong>.</li>
        <li>Pega el contenido de <code className="rounded bg-surface-2 px-1">supabase/schema.sql</code> del repositorio y pulsa <strong>Run</strong>.</li>
        <li>Vuelve aquí y recarga la página.</li>
      </ol>
    </Card>
  );
}
