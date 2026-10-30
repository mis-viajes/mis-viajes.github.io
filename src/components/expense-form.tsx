
import { Pencil, Plus, Receipt } from "lucide-react";
import { startTransition, useActionState, useEffect, useState } from "react";
import type { Expense, ExpenseShare } from "@/lib/types";
import type { FormState } from "@/lib/forms";
import { CURRENCIES, convertMinor, formatMoney, minorToInput, parseAmount, splitEvenly } from "@/lib/domain/money";
import { EXPENSE_CATEGORY, EXPENSE_STATUS } from "@/lib/labels";
import { Modal } from "./modal";
import { buttonStyles, cx } from "./ui";

export type ExpenseFormProps = {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  baseCurrency: string;
  travelers: { id: string; name: string }[];
  destinations: { id: string; label: string }[];
  /** Último tipo de cambio conocido por par, p. ej. "EUR>CLP". */
  rates: Record<string, { rate: number; date: string }>;
  initial?: Expense & { shares: ExpenseShare[] };
  /** Valores sugeridos al crear un gasto desde una reserva. */
  prefill?: Partial<{
    description: string;
    category: string;
    amountMinor: number;
    currency: string;
    date: string;
    destinationId: string;
    sourceType: string;
    sourceId: string;
  }>;
};

function Label({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="text-xs font-medium text-muted">
      {children}
    </label>
  );
}

function ErrorText({ msg }: { msg?: string }) {
  return msg ? <p className="text-xs text-danger">{msg}</p> : null;
}

export function ExpenseForm({ action, baseCurrency, travelers, destinations, rates, initial, prefill, onDone }: ExpenseFormProps & { onDone?: () => void }) {
  const [state, formAction, pending] = useActionState(action, null);
  const initialCurrency = initial?.currency ?? prefill?.currency ?? baseCurrency;
  const [currency, setCurrency] = useState(initialCurrency);
  const [status, setStatus] = useState<string>(initial?.status ?? "previsto");
  const [amount, setAmount] = useState(
    initial ? minorToInput(initial.amountMinor, initial.currency) : prefill?.amountMinor ? minorToInput(prefill.amountMinor, initialCurrency) : "",
  );
  const suggestedRate = rates[`${currency}>${baseCurrency}`];
  const [rate, setRate] = useState(
    initial && initial.currency === initialCurrency && initial.currency !== baseCurrency ? String(initial.exchangeRate) : suggestedRate ? String(suggestedRate.rate) : "",
  );
  const [participants, setParticipants] = useState<string[]>(
    initial ? initial.shares.map((s) => s.travelerId) : travelers.map((t) => t.id),
  );
  const [splitMode, setSplitMode] = useState<"igual" | "personalizado">(initial?.splitMode ?? "igual");
  const errors = state?.fieldErrors ?? {};

  useEffect(() => {
    if (state?.ok) onDone?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const changeCurrency = (c: string) => {
    setCurrency(c);
    const r = rates[`${c}>${baseCurrency}`];
    setRate(c === baseCurrency ? "" : r ? String(r.rate) : "");
  };

  const amountMinor = parseAmount(amount, currency);
  const numericRate = currency === baseCurrency ? 1 : Number(rate.replace(",", "."));
  const baseAmount = amountMinor !== null && numericRate > 0 ? convertMinor(amountMinor, currency, baseCurrency, numericRate) : null;
  const evenShares = amountMinor !== null && participants.length > 0 ? splitEvenly(amountMinor, participants.length) : [];
  const initialShareInput = (travelerId: string) => {
    const s = initial?.shares.find((x) => x.travelerId === travelerId);
    if (!s || !initial) return "";
    // Las partes se guardan en moneda base; se muestran en la moneda del gasto.
    const inOriginal = initial.exchangeRate > 0 ? Math.round(s.shareBaseMinor / (initial.amountBaseMinor / initial.amountMinor || 1)) : s.shareBaseMinor;
    return minorToInput(inOriginal, initial.currency);
  };

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => formAction(fd));
      }}
      className="space-y-4"
    >
      <input type="hidden" name="sourceType" value={initial?.sourceType ?? prefill?.sourceType ?? ""} />
      <input type="hidden" name="sourceId" value={initial?.sourceId ?? prefill?.sourceId ?? ""} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="e-description">
            Descripción <span className="text-danger">*</span>
          </Label>
          <input id="e-description" name="description" className="field" defaultValue={initial?.description ?? prefill?.description ?? ""} />
          <ErrorText msg={errors.description} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="e-amount">
            Importe <span className="text-danger">*</span>
          </Label>
          <input id="e-amount" name="amount" inputMode="decimal" className="field" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <ErrorText msg={errors.amount} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="e-currency">Moneda</Label>
          <select id="e-currency" name="currency" className="field" value={currency} onChange={(e) => changeCurrency(e.target.value)}>
            {CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        {currency !== baseCurrency && (
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="e-rate">
              Tipo de cambio: 1 {currency} = ? {baseCurrency} <span className="text-danger">*</span>
            </Label>
            <input id="e-rate" name="exchangeRate" inputMode="decimal" className="field" value={rate} onChange={(e) => setRate(e.target.value)} />
            <p className="text-xs text-muted">
              {suggestedRate ? `Último registrado: ${suggestedRate.rate} (${suggestedRate.date}). ` : "No hay un tipo de cambio registrado para este par. "}
              Queda guardado con el gasto y no cambia aunque actualices las tasas.
              {baseAmount !== null && ` Equivale a ${formatMoney(baseAmount, baseCurrency)}.`}
            </p>
            <ErrorText msg={errors.exchangeRate} />
          </div>
        )}
        <div className="space-y-1">
          <Label htmlFor="e-category">Categoría</Label>
          <select id="e-category" name="category" className="field" defaultValue={initial?.category ?? prefill?.category ?? "otros"}>
            {Object.entries(EXPENSE_CATEGORY).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="e-date">Fecha</Label>
          <input id="e-date" name="date" type="date" className="field" defaultValue={initial?.date ?? prefill?.date ?? ""} />
          <ErrorText msg={errors.date} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="e-status">Estado</Label>
          <select id="e-status" name="status" className="field" value={status} onChange={(e) => setStatus(e.target.value)}>
            {Object.entries(EXPENSE_STATUS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted">
            {status === "previsto"
              ? "Gasto futuro estimado: aún no está comprometido."
              : status === "pendiente"
                ? "Comprometido (reservado) pero sin pagar."
                : status === "parcial"
                  ? "Indica cuánto se ha pagado ya."
                  : "Ya pagado."}
          </p>
        </div>
        {status === "parcial" && (
          <div className="space-y-1">
            <Label htmlFor="e-paid">Importe ya pagado ({currency})</Label>
            <input id="e-paid" name="paidAmount" inputMode="decimal" className="field" defaultValue={initial?.paidMinor ? minorToInput(initial.paidMinor, initial.currency) : ""} />
            <ErrorText msg={errors.paidAmount} />
          </div>
        )}
        {status !== "previsto" && (
          <div className="space-y-1">
            <Label htmlFor="e-paidby">Pagado por</Label>
            <select id="e-paidby" name="paidByTravelerId" className="field" defaultValue={initial?.paidByTravelerId ?? ""}>
              <option value="">—</option>
              {travelers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <ErrorText msg={errors.paidByTravelerId} />
          </div>
        )}
        {status !== "previsto" && (
          <div className="space-y-1">
            <Label htmlFor="e-method">Método de pago</Label>
            <input id="e-method" name="paymentMethod" className="field" placeholder="Tarjeta, efectivo… (sin números de tarjeta)" defaultValue={initial?.paymentMethod ?? ""} />
          </div>
        )}
        <div className="space-y-1">
          <Label htmlFor="e-destination">Ciudad / destino</Label>
          <select id="e-destination" name="destinationId" className="field" defaultValue={initial?.destinationId ?? prefill?.destinationId ?? ""}>
            <option value="">Sin asignar</option>
            {destinations.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <fieldset className="rounded-lg border border-line p-3">
        <legend className="px-1 text-xs font-medium text-muted">Reparto entre viajeros</legend>
        {travelers.length === 0 ? (
          <p className="text-sm text-muted">Añade viajeros en Ajustes para poder dividir gastos.</p>
        ) : (
          <div className="space-y-2">
            <div className="flex gap-4 text-sm">
              {(["igual", "personalizado"] as const).map((m) => (
                <label key={m} className="flex items-center gap-1.5">
                  <input type="radio" name="splitMode" value={m} checked={splitMode === m} onChange={() => setSplitMode(m)} className="accent-[var(--color-accent)]" />
                  {m === "igual" ? "A partes iguales" : "Importes personalizados"}
                </label>
              ))}
            </div>
            <ul className="space-y-1.5">
              {travelers.map((t) => {
                const checked = participants.includes(t.id);
                const idx = participants.indexOf(t.id);
                return (
                  <li key={t.id} className="flex items-center gap-2 text-sm">
                    <label className="flex flex-1 items-center gap-2">
                      <input
                        type="checkbox"
                        name="participants"
                        value={t.id}
                        checked={checked}
                        onChange={(e) => setParticipants((p) => (e.target.checked ? [...p, t.id] : p.filter((x) => x !== t.id)))}
                        className="h-4 w-4 accent-[var(--color-accent)]"
                      />
                      {t.name}
                    </label>
                    {checked && splitMode === "igual" && evenShares[idx] !== undefined && (
                      <span className="tabular-nums text-muted">{formatMoney(evenShares[idx], currency)}</span>
                    )}
                    {checked && splitMode === "personalizado" && (
                      <input name={`share_${t.id}`} inputMode="decimal" className="field max-w-[8rem]" placeholder={currency} defaultValue={initialShareInput(t.id)} aria-label={`Parte de ${t.name}`} />
                    )}
                  </li>
                );
              })}
            </ul>
            <ErrorText msg={errors.split} />
          </div>
        )}
      </fieldset>

      <div className="space-y-1">
        <Label htmlFor="e-notes">Notas</Label>
        <textarea id="e-notes" name="notes" rows={2} className="field" defaultValue={initial?.notes ?? ""} />
      </div>

      {state?.error && !state.ok && <p className="text-sm text-danger">{state.error}</p>}
      <div className="flex justify-end">
        <button type="submit" className={buttonStyles.primary} disabled={pending}>
          {pending ? "Guardando…" : "Guardar gasto"}
        </button>
      </div>
    </form>
  );
}

export function ExpenseDialog({
  label,
  variant,
  mode = "create",
  ...props
}: ExpenseFormProps & { label?: string; variant?: keyof typeof buttonStyles; mode?: "create" | "edit" | "fromBooking" }) {
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState(0);
  const title = mode === "edit" ? "Editar gasto" : mode === "fromBooking" ? "Registrar gasto de la reserva" : "Agregar gasto";
  const style = variant ?? (mode === "edit" ? "icon" : mode === "fromBooking" ? "ghost" : "primary");
  const Icon = mode === "edit" ? Pencil : mode === "fromBooking" ? Receipt : Plus;
  return (
    <>
      <button
        type="button"
        className={cx(buttonStyles[style])}
        onClick={() => {
          setKey((k) => k + 1);
          setOpen(true);
        }}
        title={title}
        aria-label={title}
      >
        <Icon size={15} />
        {style !== "icon" && (label ?? title)}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={title} size="lg">
        <ExpenseForm key={key} {...props} onDone={() => setOpen(false)} />
      </Modal>
    </>
  );
}
