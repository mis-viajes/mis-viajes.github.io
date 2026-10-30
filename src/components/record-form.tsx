
import { Search } from "lucide-react";
import { useActionState, useEffect, useMemo, useRef, useState, startTransition, type ReactNode } from "react";
import { ENTITIES, type EntityName, type FieldDef } from "@/lib/entities";
import type { FormState } from "@/lib/forms";
import { CURRENCIES, minorToInput } from "@/lib/domain/money";
import { buttonStyles, cx } from "./ui";

export type FormContext = {
  baseCurrency: string;
  destinations?: { id: string; label: string }[];
};

type Values = Record<string, unknown>;

/** Convierte un valor guardado al texto que espera el input. */
function toInput(field: FieldDef, values: Values, baseCurrency: string): string | boolean {
  const v = values[field.name];
  if (field.type === "checkbox") return Boolean(v ?? field.defaultValue);
  if (v === null || v === undefined) {
    if (field.type === "currency") return (field.defaultValue as string) ?? baseCurrency;
    return (field.defaultValue as string) ?? "";
  }
  if (field.type === "money") {
    const currency = (values[field.currencyField ?? "currency"] as string) || baseCurrency;
    return minorToInput(v as number, currency);
  }
  return String(v);
}

export function RecordForm({
  entity,
  action,
  initial = {},
  context,
  onDone,
  submitLabel = "Guardar",
  extraFields,
  hiddenFields,
}: {
  entity: EntityName;
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  initial?: Values;
  context: FormContext;
  onDone?: (state: NonNullable<FormState>) => void;
  submitLabel?: string;
  extraFields?: ReactNode;
  hiddenFields?: Record<string, string>;
}) {
  const def = ENTITIES[entity];
  const [state, formAction, pending] = useActionState(action, null);
  const formRef = useRef<HTMLFormElement>(null);
  const basic = def.fields.filter((f) => !f.advanced);
  const advanced = def.fields.filter((f) => f.advanced);

  useEffect(() => {
    if (state?.ok) onDone?.(state);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form
      ref={formRef}
      noValidate
      onSubmit={(e) => {
        // Envío manual: evita que React reinicie el formulario si hay errores de validación.
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => formAction(fd));
      }}
      className="space-y-4"
    >
      {hiddenFields && Object.entries(hiddenFields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <div className="grid gap-3 sm:grid-cols-2">
        {basic.map((f) => (
          <Field key={f.name} field={f} initial={initial} context={context} error={state?.fieldErrors?.[f.name]} formRef={formRef} />
        ))}
      </div>
      {advanced.length > 0 && (
        <details className="group rounded-lg border border-line" open={advanced.some((f) => state?.fieldErrors?.[f.name])}>
          <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium text-muted hover:text-ink">Más detalles</summary>
          <div className="grid gap-3 border-t border-line p-3 sm:grid-cols-2">
            {advanced.map((f) => (
              <Field key={f.name} field={f} initial={initial} context={context} error={state?.fieldErrors?.[f.name]} formRef={formRef} />
            ))}
          </div>
        </details>
      )}
      {extraFields}
      {state?.error && <p className={cx("text-sm", state.ok ? "text-warning" : "text-danger")}>{state.error}</p>}
      <div className="flex justify-end gap-2 pt-1">
        <button type="submit" className={buttonStyles.primary} disabled={pending}>
          {pending ? "Guardando…" : submitLabel}
        </button>
      </div>
    </form>
  );
}

let tzCache: string[] | null = null;
function timeZones(): string[] {
  if (tzCache) return tzCache;
  try {
    tzCache = (Intl as unknown as { supportedValuesOf: (k: string) => string[] }).supportedValuesOf("timeZone");
  } catch {
    tzCache = [];
  }
  return tzCache;
}

export function Field({
  field,
  initial,
  context,
  error,
  formRef,
}: {
  field: FieldDef;
  initial: Values;
  context: FormContext;
  error?: string;
  formRef: React.RefObject<HTMLFormElement | null>;
}) {
  const value = toInput(field, initial, context.baseCurrency);
  const id = `f-${field.name}`;
  const common = { id, name: field.name, "aria-invalid": Boolean(error), className: "field" };

  let control: ReactNode;
  switch (field.type) {
    case "textarea":
      control = <textarea {...common} rows={3} defaultValue={value as string} placeholder={field.placeholder} />;
      break;
    case "select":
      control = (
        <select {...common} defaultValue={value as string}>
          {!field.required && !field.defaultValue && <option value="">—</option>}
          {field.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      );
      break;
    case "currency":
      control = (
        <select {...common} defaultValue={value as string}>
          {CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      );
      break;
    case "destination":
      control = (
        <select {...common} defaultValue={value as string}>
          <option value="">Sin asignar</option>
          {context.destinations?.map((d) => (
            <option key={d.id} value={d.id}>
              {d.label}
            </option>
          ))}
        </select>
      );
      break;
    case "checkbox":
      return (
        <label className={cx("flex items-center gap-2 self-end py-2 text-sm", field.wide && "sm:col-span-2")}>
          <input type="checkbox" name={field.name} defaultChecked={value as boolean} className="h-4 w-4 accent-[var(--color-accent)]" />
          {field.label}
        </label>
      );
    case "rating":
      control = (
        <select {...common} defaultValue={value as string}>
          <option value="">Sin calificar</option>
          {[5, 4, 3, 2, 1].map((n) => (
            <option key={n} value={n}>
              {"★".repeat(n)}
            </option>
          ))}
        </select>
      );
      break;
    case "timezone":
      control = (
        <>
          <input {...common} list="tz-list" defaultValue={value as string} placeholder={field.placeholder} autoComplete="off" />
          <TimezoneList />
        </>
      );
      break;
    case "location":
      return <LocationField field={field} initial={initial} error={error} formRef={formRef} />;
    default: {
      const inputType =
        field.type === "date"
          ? "date"
          : field.type === "datetime"
            ? "datetime-local"
            : field.type === "time"
              ? "time"
              : field.type === "url"
                ? "url"
                : "text";
      const inputMode = field.type === "money" || field.type === "number" ? "decimal" : field.type === "integer" ? "numeric" : undefined;
      control = <input {...common} type={inputType} inputMode={inputMode} defaultValue={value as string} placeholder={field.placeholder} />;
    }
  }

  return (
    <div className={cx("space-y-1", field.wide && "sm:col-span-2")}>
      <label htmlFor={id} className="text-xs font-medium text-muted">
        {field.label}
        {field.required && <span className="text-danger"> *</span>}
      </label>
      {control}
      {error ? <p className="text-xs text-danger">{error}</p> : field.help ? <p className="text-xs text-muted">{field.help}</p> : null}
    </div>
  );
}

function TimezoneList() {
  const zones = useMemo(() => timeZones(), []);
  return (
    <datalist id="tz-list">
      {zones.map((z) => (
        <option key={z} value={z} />
      ))}
    </datalist>
  );
}

type GeoResult = { display_name: string; lat: string; lon: string };

/**
 * Coordenadas con búsqueda en OpenStreetMap Nominatim (servicio público, sin clave).
 * Se busca solo al pulsar el botón para respetar su política de uso (máx. 1 petición/segundo).
 */
function LocationField({
  field,
  initial,
  error,
  formRef,
}: {
  field: FieldDef;
  initial: Values;
  error?: string;
  formRef: React.RefObject<HTMLFormElement | null>;
}) {
  const latRef = useRef<HTMLInputElement>(null);
  const lngRef = useRef<HTMLInputElement>(null);
  const [results, setResults] = useState<GeoResult[] | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fmt = (v: unknown) => (typeof v === "number" ? String(v) : "");

  const search = async () => {
    const form = formRef.current;
    if (!form) return;
    const query = (field.queryFields ?? [])
      .map((n) => (form.elements.namedItem(n) as HTMLInputElement | null)?.value?.trim())
      .filter(Boolean)
      .join(", ");
    if (!query) {
      setStatus("Escribe primero el nombre, la dirección o la ciudad.");
      return;
    }
    setLoading(true);
    setStatus(null);
    try {
      const params = new URLSearchParams({ q: query, format: "json", limit: "5", "accept-language": "es" });
      const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`);
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as GeoResult[];
      setResults(data);
      if (data.length === 0) setStatus(`Sin resultados para «${query}». Prueba con menos detalle o introduce las coordenadas.`);
    } catch {
      setStatus("No se pudo consultar el buscador de mapas. Revisa tu conexión o introduce las coordenadas a mano.");
    } finally {
      setLoading(false);
    }
  };

  const choose = (r: GeoResult) => {
    if (latRef.current) latRef.current.value = Number(r.lat).toFixed(6);
    if (lngRef.current) lngRef.current.value = Number(r.lon).toFixed(6);
    setResults(null);
    setStatus(`Ubicación seleccionada: ${r.display_name}`);
  };

  return (
    <div className="space-y-1 sm:col-span-2">
      <p className="text-xs font-medium text-muted">{field.label}</p>
      <div className="flex flex-wrap gap-2">
        <input ref={latRef} name={field.latName} defaultValue={fmt(initial[field.latName!])} placeholder="Latitud" inputMode="decimal" className="field max-w-[10rem]" aria-label="Latitud" />
        <input ref={lngRef} name={field.lngName} defaultValue={fmt(initial[field.lngName!])} placeholder="Longitud" inputMode="decimal" className="field max-w-[10rem]" aria-label="Longitud" />
        <button type="button" onClick={search} disabled={loading} className={buttonStyles.secondary}>
          <Search size={15} />
          {loading ? "Buscando…" : "Buscar ubicación"}
        </button>
      </div>
      {results && results.length > 0 && (
        <ul className="mt-1 divide-y divide-line overflow-hidden rounded-lg border border-line">
          {results.map((r) => (
            <li key={`${r.lat},${r.lon}`}>
              <button type="button" onClick={() => choose(r)} className="w-full px-3 py-2 text-left text-sm hover:bg-surface-2">
                {r.display_name}
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="text-xs text-danger">{error}</p>}
      {status && <p className="text-xs text-muted">{status}</p>}
      <p className="text-xs text-muted">Búsqueda: © colaboradores de OpenStreetMap (Nominatim).</p>
    </div>
  );
}
