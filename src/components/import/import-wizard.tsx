
import { CheckCircle2, FileUp, Loader2, Sparkles, TriangleAlert, X } from "lucide-react";
import { Link } from "react-router";
import { useMemo, useState } from "react";
import { confirmImportItem } from "@/lib/import/confirm";
import { getApiKey } from "@/lib/import/api-key";
import { uploadDocument, validateFile } from "@/lib/storage";
import type { Extraction, ExtractedActivity, ExtractedFlight, ExtractedLodging, ExtractedTransport } from "@/lib/import/schema";
import { suggestDestination } from "@/lib/domain/itinerary";
import { parseAmount, minorToInput } from "@/lib/domain/money";
import { BAGGAGE_CATEGORY, EXPENSE_STATUS, TRANSPORT_TYPE } from "@/lib/labels";
import type { Destination } from "@/lib/types";
import { RecordForm, type FormContext } from "../record-form";
import { Badge, buttonStyles, Card, cx } from "../ui";

type Kind = "flight" | "lodging" | "transport" | "activity";
type Item =
  | { kind: "flight"; data: ExtractedFlight }
  | { kind: "lodging"; data: ExtractedLodging }
  | { kind: "transport"; data: ExtractedTransport }
  | { kind: "activity"; data: ExtractedActivity };

type Result = { extraction: Extraction; documentId: string | null; fileName: string | null; saveWarning: string | null };

const KIND_LABEL: Record<Kind, string> = { flight: "Vuelo", lodging: "Alojamiento", transport: "Transporte", activity: "Actividad" };
const SECTION: Record<Kind, string> = { flight: "flights", lodging: "lodging", transport: "transport", activity: "activities" };

export function ImportWizard({
  tripId,
  trip,
  context,
  destinations,
  travelers,
  rates,
}: {
  tripId: string;
  trip: { name: string; startDate: string; endDate: string };
  context: FormContext;
  destinations: Destination[];
  travelers: { id: string; name: string }[];
  rates: Record<string, { rate: number; date: string }>;
}) {
  const [mode, setMode] = useState<"file" | "text">("file");
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [keepFile, setKeepFile] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [dragging, setDragging] = useState(false);
  const configured = Boolean(getApiKey());

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (mode === "file") {
      if (!file) return setError("Selecciona un archivo.");
      const invalid = validateFile(file);
      if (invalid) return setError(invalid);
    } else if (!text.trim()) {
      return setError("Pega el texto de la confirmación.");
    }
    setLoading(true);
    try {
      // El SDK de Anthropic se carga solo cuando se usa (reduce el peso inicial de la app).
      const { extractBookings } = await import("@/lib/import/extract");
      const extraction = await extractBookings(mode === "file" ? { kind: "file", file: file! } : { kind: "text", text }, { tripName: trip.name, startDate: trip.startDate, endDate: trip.endDate });
      let documentId: string | null = null;
      let saveWarning: string | null = null;
      if (mode === "file" && keepFile && file) {
        try {
          const doc = await uploadDocument(tripId, file, { title: extraction.documentType || file.name, type: guessDocumentType(extraction) });
          documentId = doc.id;
        } catch (err) {
          saveWarning = err instanceof Error ? err.message : "No se pudo guardar el archivo.";
        }
      }
      setResult({ extraction, documentId, fileName: mode === "file" ? (file?.name ?? null) : null, saveWarning });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo procesar el documento.");
    } finally {
      setLoading(false);
    }
  };

  const items: Item[] = useMemo(() => {
    if (!result) return [];
    const x = result.extraction;
    return [
      ...x.flights.map((data) => ({ kind: "flight" as const, data })),
      ...x.lodgings.map((data) => ({ kind: "lodging" as const, data })),
      ...x.transports.map((data) => ({ kind: "transport" as const, data })),
      ...x.activities.map((data) => ({ kind: "activity" as const, data })),
    ];
  }, [result]);

  if (!configured) {
    return (
      <Card className="p-5">
        <p className="flex items-center gap-2 font-medium">
          <TriangleAlert size={18} className="text-warning" /> Falta configurar la importación inteligente
        </p>
        <p className="mt-2 text-sm text-muted">
          Para extraer datos de PDFs y capturas, la app usa la API de Claude (Anthropic) con tu propia clave. Añádela en{" "}
          <Link to="/ajustes" className="text-accent underline">Ajustes de la app</Link>. Cada importación tiene un costo de uso de la API.
          Mientras tanto puedes registrar las reservas a mano.
        </p>
      </Card>
    );
  }

  if (result) {
    return (
      <div className="space-y-4">
        <Card className="p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="flex items-center gap-2 font-medium">
                <Sparkles size={17} className="text-accent" /> {result.extraction.documentType}
              </p>
              <p className="text-sm text-muted">{result.extraction.summary}</p>
              {result.documentId && <p className="mt-1 text-xs text-muted">El archivo se guardó en Documentos.</p>}
              {result.saveWarning && <p className="mt-1 text-xs text-warning">{result.saveWarning}</p>}
            </div>
            <button type="button" className={buttonStyles.secondary} onClick={() => setResult(null)}>
              Importar otro documento
            </button>
          </div>
          {result.extraction.warnings.length > 0 && (
            <ul className="mt-3 space-y-1 rounded-lg bg-warning-soft p-3 text-sm text-warning">
              {result.extraction.warnings.map((w, i) => (
                <li key={i} className="flex gap-2">
                  <TriangleAlert size={15} className="mt-0.5 shrink-0" /> {w}
                </li>
              ))}
            </ul>
          )}
        </Card>
        {items.length === 0 ? (
          <Card className="p-4 text-sm text-muted">No se encontraron reservas en el documento.</Card>
        ) : (
          <>
            <p className="text-sm text-muted">
              Revisa y corrige cada elemento antes de guardarlo. Nada se guarda hasta que pulses «Guardar». Los datos que no aparecían en el documento quedan vacíos.
            </p>
            {items.map((item, i) => (
              <ReviewCard
                key={i}
                index={i}
                item={item}
                previous={items[i - 1]}
                tripId={tripId}
                documentId={result.documentId}
                context={context}
                destinations={destinations}
                travelers={travelers}
                rates={rates}
              />
            ))}
          </>
        )}
      </div>
    );
  }

  return (
    <Card className="p-5">
      <div className="mb-4 flex gap-2 text-sm">
        {(["file", "text"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={cx("rounded-full border px-3 py-1", mode === m ? "border-accent bg-accent-soft text-accent" : "border-line text-muted")}
          >
            {m === "file" ? "Subir PDF o imagen" : "Pegar texto del correo"}
          </button>
        ))}
      </div>
      <form onSubmit={submit} className="space-y-4">
        {mode === "file" ? (
          <>
            <label
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                if (e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]);
              }}
              className={cx(
                "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-10 text-center transition",
                dragging ? "border-accent bg-accent-soft" : "border-line hover:border-accent/50",
              )}
            >
              <FileUp size={30} className="mb-2 text-muted" />
              {file ? (
                <span className="flex items-center gap-2 text-sm font-medium">
                  {file.name} <span className="text-muted">({(file.size / 1024).toFixed(0)} KB)</span>
                  <button type="button" onClick={(e) => { e.preventDefault(); setFile(null); }} aria-label="Quitar archivo" className="text-muted hover:text-ink">
                    <X size={15} />
                  </button>
                </span>
              ) : (
                <>
                  <span className="text-sm font-medium">Arrastra aquí la confirmación o haz clic para elegirla</span>
                  <span className="mt-1 text-xs text-muted">PDF, PNG, JPG, WEBP o TXT · máx. 20 MB</span>
                </>
              )}
              <input
                type="file"
                className="sr-only"
                accept="application/pdf,image/png,image/jpeg,image/webp,image/gif,text/plain"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={keepFile} onChange={(e) => setKeepFile(e.target.checked)} className="h-4 w-4 accent-[var(--color-accent)]" />
              Guardar también el archivo en Documentos del viaje
            </label>
          </>
        ) : (
          <textarea
            className="field min-h-48"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Pega aquí el contenido del correo de confirmación…"
            aria-label="Texto de la confirmación"
          />
        )}
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-md text-xs text-muted">
            El documento se envía directamente desde tu navegador a la API de Claude (Anthropic) solo para extraer los datos. Revisarás todo antes de guardarlo.
          </p>
          <button type="submit" className={buttonStyles.primary} disabled={loading}>
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {loading ? "Analizando documento…" : "Extraer datos"}
          </button>
        </div>
      </form>
    </Card>
  );
}

function toInitial(item: Item, previous: Item | undefined, destinations: Destination[]): Record<string, unknown> {
  const money = (v: number | null, cur: string | null) => (v === null ? null : parseAmount(v, cur ?? "CLP"));
  const status = (s: string) => (s === "confirmado" ? "confirmado" : "reservado");
  switch (item.kind) {
    case "flight": {
      const f = item.data;
      const prev = previous?.kind === "flight" ? previous.data : null;
      return {
        ...f,
        departureTz: f.departureTimezone,
        arrivalTz: f.arrivalTimezone,
        priceMinor: money(f.price, f.currency),
        bookingStatus: status(f.bookingStatus),
        // Sugerencia: si sale desde donde llegó el vuelo anterior, es una conexión.
        direction: !prev ? "ida" : prev.destinationCode && prev.destinationCode === f.originCode ? "conexion" : "vuelta",
      };
    }
    case "lodging": {
      const l = item.data;
      return {
        ...l,
        priceMinor: money(l.price, l.currency),
        taxesMinor: money(l.taxes, l.currency),
        bookingStatus: status(l.bookingStatus),
        destinationId: suggestDestination(destinations, l.city, l.checkInDate)?.id ?? null,
      };
    }
    case "transport": {
      const t = item.data;
      return { ...t, priceMinor: money(t.price, t.currency), bookingStatus: status(t.bookingStatus) };
    }
    case "activity": {
      const a = item.data;
      return {
        ...a,
        priceMinor: money(a.price, a.currency),
        bookingStatus: status(a.bookingStatus),
        requiresBooking: Boolean(a.bookingCode),
        destinationId: suggestDestination(destinations, a.city, a.date)?.id ?? null,
      };
    }
  }
}

function describe(item: Item): string {
  switch (item.kind) {
    case "flight":
      return `${[item.data.airline, item.data.flightNumber].filter(Boolean).join(" ")} ${item.data.originCode ?? "?"} → ${item.data.destinationCode ?? "?"}`.trim();
    case "lodging":
      return item.data.name;
    case "transport":
      return `${TRANSPORT_TYPE[item.data.type]} ${item.data.origin ?? "?"} → ${item.data.destination ?? "?"}`;
    case "activity":
      return item.data.name;
  }
}

function serviceDate(item: Item): string {
  switch (item.kind) {
    case "flight":
      return item.data.departureLocal?.slice(0, 10) ?? "";
    case "lodging":
      return item.data.checkInDate ?? "";
    case "transport":
      return item.data.departureLocal?.slice(0, 10) ?? "";
    case "activity":
      return item.data.date ?? "";
  }
}

function ReviewCard({
  index,
  item,
  previous,
  tripId,
  documentId,
  context,
  destinations,
  travelers,
  rates,
}: {
  index: number;
  item: Item;
  previous?: Item;
  tripId: string;
  documentId: string | null;
  context: FormContext;
  destinations: Destination[];
  travelers: { id: string; name: string }[];
  rates: Record<string, { rate: number; date: string }>;
}) {
  const [saved, setSaved] = useState<{ warning?: string } | null>(null);
  const [discarded, setDiscarded] = useState(false);
  const initial = useMemo(() => toInitial(item, previous, destinations), [item, previous, destinations]);
  const currency = item.data.currency?.toUpperCase() ?? context.baseCurrency;
  const hasPrice = item.data.price !== null;
  const paymentDefault = item.data.paymentStatus === "desconocido" ? "pendiente" : item.data.paymentStatus;
  const rate = rates[`${currency}>${context.baseCurrency}`];
  const action = useMemo(() => confirmImportItem.bind(null, tripId, item.kind, documentId), [tripId, item.kind, documentId]);

  if (discarded) {
    return (
      <Card className="flex items-center justify-between p-3 text-sm text-muted">
        <span>{KIND_LABEL[item.kind]} descartado: {describe(item)}</span>
        <button type="button" className={buttonStyles.ghost} onClick={() => setDiscarded(false)}>
          Deshacer
        </button>
      </Card>
    );
  }

  if (saved) {
    return (
      <Card className="p-4">
        <p className="flex items-center gap-2 text-sm font-medium text-success">
          <CheckCircle2 size={17} /> {KIND_LABEL[item.kind]} guardado: {describe(item)}
        </p>
        {saved.warning && <p className="mt-1 text-sm text-warning">{saved.warning}</p>}
        <Link to={`/trips/${tripId}/${SECTION[item.kind]}`} className="mt-1 inline-block text-sm text-accent hover:underline">
          Ver en {KIND_LABEL[item.kind].toLowerCase()}s
        </Link>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 font-medium">
          <Badge tone="accent">{KIND_LABEL[item.kind]}</Badge> {describe(item)}
        </p>
        <button type="button" className={buttonStyles.ghost} onClick={() => setDiscarded(true)}>
          Descartar
        </button>
      </div>
      <RecordForm
        entity={item.kind}
        action={action}
        initial={initial}
        context={context}
        submitLabel="Guardar"
        onDone={(state) => setSaved({ warning: state.error })}
        extraFields={
          <div className="space-y-3">
            {item.kind === "flight" && <BaggageReview flight={item.data} />}
            <fieldset className="rounded-lg border border-line p-3">
              <legend className="px-1 text-xs font-medium text-muted">Gasto asociado</legend>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="createExpense" defaultChecked={hasPrice} className="h-4 w-4 accent-[var(--color-accent)]" />
                Registrar el precio en Finanzas
              </label>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-medium text-muted" htmlFor={`ed-${index}`}>Descripción del gasto</label>
                  <input id={`ed-${index}`} name="expenseDescription" className="field" defaultValue={describe(item)} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted" htmlFor={`es-${index}`}>Estado del pago</label>
                  <select id={`es-${index}`} name="expenseStatus" className="field" defaultValue={paymentDefault}>
                    {Object.entries(EXPENSE_STATUS).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                  {item.data.paymentStatus === "desconocido" && <p className="text-xs text-muted">El documento no indica si está pagado.</p>}
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted" htmlFor={`ep-${index}`}>Ya pagado (si es parcial)</label>
                  <input id={`ep-${index}`} name="expensePaid" inputMode="decimal" className="field" defaultValue={item.data.amountPaid !== null ? minorToInput(parseAmount(item.data.amountPaid, currency), currency) : ""} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted" htmlFor={`eb-${index}`}>Pagado por</label>
                  <select id={`eb-${index}`} name="expensePaidBy" className="field" defaultValue="">
                    <option value="">—</option>
                    {travelers.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted" htmlFor={`edt-${index}`}>Fecha del gasto</label>
                  <input id={`edt-${index}`} type="date" name="expenseDate" className="field" defaultValue={serviceDate(item)} />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-medium text-muted" htmlFor={`er-${index}`}>
                    Tipo de cambio a {context.baseCurrency} (solo si la moneda es distinta)
                  </label>
                  <input id={`er-${index}`} name="expenseRate" inputMode="decimal" className="field" defaultValue={currency !== context.baseCurrency && rate ? String(rate.rate) : ""} placeholder={`1 ${currency} = ? ${context.baseCurrency}`} />
                </div>
              </div>
              <p className="mt-2 text-xs text-muted">El gasto se repartirá a partes iguales entre todos los viajeros; puedes cambiarlo después en Finanzas.</p>
            </fieldset>
          </div>
        }
      />
    </Card>
  );
}

function BaggageReview({ flight }: { flight: ExtractedFlight }) {
  const rows = flight.baggage;
  return (
    <fieldset className="rounded-lg border border-line p-3">
      <legend className="px-1 text-xs font-medium text-muted">Equipaje detectado</legend>
      <input type="hidden" name="baggageCount" value={rows.length} />
      {rows.length === 0 ? (
        <p className="text-sm text-warning">El documento no indica la franquicia de equipaje. Podrás añadirla después en el vuelo.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((b, i) => (
            <div key={i} className="grid grid-cols-2 gap-2 sm:grid-cols-[auto_1fr_5rem_5rem_1fr]">
              <label className="flex items-center gap-1.5 text-sm">
                <input type="checkbox" name={`baggage_${i}_keep`} defaultChecked className="h-4 w-4 accent-[var(--color-accent)]" />
                Guardar
              </label>
              <select name={`baggage_${i}_category`} defaultValue={b.category} className="field py-1.5" aria-label="Tipo">
                {Object.entries(BAGGAGE_CATEGORY).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
              <input name={`baggage_${i}_quantity`} defaultValue={b.quantity ?? ""} placeholder="Piezas" className="field py-1.5" aria-label="Piezas" />
              <input name={`baggage_${i}_maxWeightKg`} defaultValue={b.maxWeightKg ?? ""} placeholder="kg" className="field py-1.5" aria-label="Peso máximo (kg)" />
              <input name={`baggage_${i}_maxDimensions`} defaultValue={b.maxDimensions ?? ""} placeholder="Dimensiones" className="field py-1.5" aria-label="Dimensiones" />
              {b.notes && <input type="hidden" name={`baggage_${i}_notes`} value={b.notes} />}
            </div>
          ))}
        </div>
      )}
    </fieldset>
  );
}

function guessDocumentType(x: Extraction) {
  if (x.flights.length) return "billete_avion" as const;
  if (x.lodgings.length) return "reserva_alojamiento" as const;
  if (x.transports.length) return "billete_transporte" as const;
  if (x.activities.length) return "entrada" as const;
  return "otro" as const;
}
