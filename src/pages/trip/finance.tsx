import { useExchangeRates } from "@/lib/hooks";
import { useSearchParams } from "react-router";
import { useTrip } from "@/pages/trip/context";
import { ArrowRight, Download, Wallet } from "lucide-react";
import { Link } from "react-router";
import { deleteEntity, deleteExpense, saveEntity, saveExpense, setExpenseStatus } from "@/lib/api";
import { DeleteButton } from "@/components/delete-button";
import { ExpenseDialog } from "@/components/expense-form";
import { CategoryBar, PersonBars } from "@/components/finance-charts";
import { MarkPaidButton } from "@/components/mark-paid";
import { RecordDialog } from "@/components/record-dialog";
import { Badge, buttonStyles, Card, cx, EmptyState, EXPENSE_TONE, PageHeader, SectionTitle } from "@/components/ui";
import { formatDate, todayISO } from "@/lib/domain/dates";
import { downloadText, expensesCsv } from "@/lib/export-csv";
import { bucketOf, summarizeFinances, type Bucket } from "@/lib/domain/finance";
import { formatMoney } from "@/lib/domain/money";
import { EXPENSE_CATEGORY, EXPENSE_STATUS } from "@/lib/labels";
import { destinationName, expenseFormBase, travelerName } from "@/lib/trip-helpers";

const FILTERS = [
  { key: "", label: "Todos" },
  { key: "pagado", label: "Pagados" },
  { key: "pendiente", label: "Pendientes" },
  { key: "previsto", label: "Previstos" },
];

export default function FinancePage() {
  const { b, tripId, rates } = useTrip();
  const [searchParams] = useSearchParams();
  const estado = searchParams.get("estado") ?? undefined;
  const rateHistory = useExchangeRates().data ?? [];
  const base = b.trip.baseCurrency;
  const f = summarizeFinances(b.expenses, b.travelers, base, b.trip.budgetMinor);
  const money = (v: number | null) => formatMoney(v, base);
  const formBase = expenseFormBase(b, rates);
  const travelers = b.travelers.map((t) => ({ id: t.id, name: t.name }));

  const filtered = b.expenses.filter((e) =>
    !estado ? true : estado === "pendiente" ? e.status === "pendiente" || e.status === "parcial" : estado === "pagado" ? e.status === "pagado" : e.status === estado,
  );
  const scale = Math.max(f.totals.projected, f.budget ?? 0, 1);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Finanzas del viaje"
        subtitle={`Importes en ${base}. Cada gasto conserva el tipo de cambio con que se registró.`}
        actions={
          <>
            {b.expenses.length > 0 && (
              <button
                type="button"
                className={buttonStyles.secondary}
                onClick={() => downloadText(expensesCsv(b), `gastos-${b.trip.name.normalize("NFD").replace(/[^\w-]+/g, "_")}.csv`, "text/csv;charset=utf-8")}
              >
                <Download size={16} /> Exportar CSV
              </button>
            )}
            <ExpenseDialog action={saveExpense.bind(null, tripId, null)} {...formBase} prefill={{ date: todayISO() }} />
          </>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Total label="Pagado" value={money(f.totals.paid)} hint="Dinero que ya salió" tone="success" />
        <Total label="Pendiente de pago" value={money(f.totals.pending)} hint="Reservado o comprometido, sin pagar" tone="warning" />
        <Total label="Previsto (futuro)" value={money(f.totals.planned)} hint="Estimaciones aún no comprometidas" />
        <Total
          label={f.budget !== null ? "Disponible del presupuesto" : "Total del viaje"}
          value={f.budget !== null ? money(f.budgetRemaining) : money(f.totals.projected)}
          hint={f.budget !== null ? `Presupuesto ${money(f.budget)} · total previsto ${money(f.totals.projected)}` : "Pagado + pendiente + previsto"}
          tone={f.budgetRemaining !== null && f.budgetRemaining < 0 ? "danger" : undefined}
        />
      </section>

      <Card className="p-4">
        <p className="mb-2 text-sm font-medium">{f.budget !== null ? "Gasto total frente al presupuesto" : "Composición del gasto"}</p>
        <div className="relative h-4 w-full overflow-hidden rounded-full bg-surface-2">
          <div className="flex h-full">
            <div className="bg-success" style={{ width: `${(f.totals.paid / scale) * 100}%` }} title={`Pagado ${money(f.totals.paid)}`} />
            <div className="bg-warning" style={{ width: `${(f.totals.pending / scale) * 100}%` }} title={`Pendiente ${money(f.totals.pending)}`} />
            <div className="bg-muted/40" style={{ width: `${(f.totals.planned / scale) * 100}%` }} title={`Previsto ${money(f.totals.planned)}`} />
          </div>
          {f.budget !== null && <div className="absolute inset-y-0 w-0.5 bg-ink" style={{ left: `${Math.min(100, (f.budget / scale) * 100)}%` }} title="Presupuesto" />}
        </div>
        <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted">
          <Legend className="bg-success" label="Pagado" />
          <Legend className="bg-warning" label="Pendiente" />
          <Legend className="bg-muted/40" label="Previsto" />
          {f.budget !== null && <Legend className="bg-ink" label="Presupuesto" />}
        </div>
      </Card>

      <section>
        <SectionTitle title="Cuentas entre viajeros" subtitle="Quién ha pagado cuánto y cómo quedar a mano (solo cuenta lo ya pagado)." />
        {b.travelers.length === 0 ? (
          <Card className="p-4 text-sm text-muted">
            Añade viajeros en <Link className="text-accent underline" to={`/trips/${tripId}/settings`}>Ajustes</Link> para dividir gastos.
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
            <Card className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted">
                  <tr className="border-b border-line">
                    <th className="px-4 py-2 font-medium">Viajero</th>
                    <th className="px-4 py-2 text-right font-medium">Ha pagado</th>
                    <th className="px-4 py-2 text-right font-medium">Le corresponde</th>
                    <th className="px-4 py-2 text-right font-medium">Saldo</th>
                    <th className="px-4 py-2 text-right font-medium">Su parte del total</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {f.balances.map((x) => (
                    <tr key={x.traveler.id} className="border-b border-line last:border-0">
                      <td className="px-4 py-2 font-medium">{x.traveler.name}</td>
                      <td className="px-4 py-2 text-right">{money(x.paid)}</td>
                      <td className="px-4 py-2 text-right">{money(x.shareOfPaid)}</td>
                      <td className={cx("px-4 py-2 text-right font-medium", x.balance > 0 ? "text-success" : x.balance < 0 ? "text-danger" : "")}>
                        {x.balance > 0 ? "+" : ""}
                        {money(x.balance)}
                      </td>
                      <td className="px-4 py-2 text-right text-muted">{money(x.shareTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="px-4 pb-3 text-xs text-muted">
                Saldo positivo: le deben dinero. Negativo: debe dinero. «Su parte del total» incluye pendientes y previstos.
                {f.paidWithoutPayer > 0 && ` Hay ${money(f.paidWithoutPayer)} pagados sin indicar quién pagó.`}
              </p>
            </Card>
            <Card className="p-4">
              <p className="mb-2 text-sm font-medium">Para quedar a mano</p>
              {f.settlements.length === 0 ? (
                <p className="text-sm text-muted">Las cuentas están equilibradas.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {f.settlements.map((s, i) => (
                    <li key={i} className="flex flex-wrap items-center gap-1.5">
                      <strong>{s.from.name}</strong> <ArrowRight size={14} className="text-muted" /> <strong>{s.to.name}</strong>
                      <span className="ml-auto tabular-nums">{money(s.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        )}
      </section>

      {b.expenses.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          <CategoryBar byCategory={f.byCategory} money={money} />
          {b.travelers.length > 0 && <PersonBars balances={f.balances} money={money} />}
          <BreakdownCard
            title="Por ciudad"
            rows={Object.entries(f.byDestination).map(([k, v]) => ({ label: destinationName(b, k) ?? "Sin ciudad", bucket: v }))}
            total={f.totals.projected}
            money={money}
          />
        </div>
      )}

      <section>
        <SectionTitle title="Gastos" subtitle={`${b.expenses.length} registrados`} />
        {b.expenses.length === 0 ? (
          <EmptyState icon={<Wallet size={32} />} title="Sin gastos registrados">
            Registra lo que ya pagaste, lo pendiente y los gastos futuros que prevés (comidas, entradas, compras…).
          </EmptyState>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap gap-2 text-sm">
              {FILTERS.map((x) => (
                <Link
                  key={x.key}
                  to={`/trips/${tripId}/finance${x.key ? `?estado=${x.key}` : ""}`}
                  className={cx("rounded-full border px-3 py-1", (estado ?? "") === x.key ? "border-accent bg-accent-soft text-accent" : "border-line text-muted hover:text-ink")}
                >
                  {x.label}
                </Link>
              ))}
            </div>
            <Card className="divide-y divide-line">
              {filtered.length === 0 && <p className="p-4 text-sm text-muted">No hay gastos en este estado.</p>}
              {filtered.map((e) => {
                const bucket = bucketOf(e, base);
                const payer = travelerName(b, e.paidByTravelerId);
                const sharedWith = e.shares.map((s) => travelerName(b, s.travelerId)).filter(Boolean);
                return (
                  <div key={e.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{e.description}</span>
                        <Badge tone={EXPENSE_TONE[e.status]}>{EXPENSE_STATUS[e.status]}</Badge>
                      </div>
                      <p className="text-xs text-muted">
                        {[
                          e.date ? formatDate(e.date) : null,
                          EXPENSE_CATEGORY[e.category],
                          destinationName(b, e.destinationId),
                          payer ? `pagó ${payer}` : null,
                          sharedWith.length ? `entre ${sharedWith.join(", ")}` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <div className="text-right tabular-nums">
                      <p className="font-medium">{formatMoney(e.amountMinor, e.currency)}</p>
                      {e.currency !== base && (
                        <p className="text-xs text-muted">
                          {money(e.amountBaseMinor)} · 1 {e.currency} = {e.exchangeRate} {base}
                        </p>
                      )}
                      {e.status === "parcial" && <p className="text-xs text-muted">Pagado {money(bucket.paid)} · falta {money(bucket.pending)}</p>}
                    </div>
                    <div className="flex items-center gap-1">
                      {(e.status === "pendiente" || e.status === "parcial" || e.status === "previsto") && (
                        <MarkPaidButton
                          action={setExpenseStatus.bind(null, tripId, e.id, "pagado")}
                          travelers={travelers}
                          defaultPayer={e.paidByTravelerId}
                        />
                      )}
                      <ExpenseDialog mode="edit" action={saveExpense.bind(null, tripId, e.id)} {...formBase} initial={e} />
                      <DeleteButton itemName={e.description} action={deleteExpense.bind(null, tripId, e.id)} />
                    </div>
                  </div>
                );
              })}
            </Card>
          </>
        )}
      </section>

      <section>
        <SectionTitle
          title="Tipos de cambio"
          subtitle="Se usan como sugerencia al registrar gastos en otra moneda. Cambiarlos no modifica gastos ya registrados."
          action={<RecordDialog entity="exchangeRate" action={saveEntity.bind(null, "exchangeRate", tripId, null, null)} context={{ baseCurrency: base }} initial={{ toCurrency: base, date: todayISO() }} variant="secondary" />}
        />
        {rateHistory.length === 0 ? (
          <Card className="p-4 text-sm text-muted">No hay tipos de cambio registrados. Añade, por ejemplo, 1 EUR = ? {base}.</Card>
        ) : (
          <Card className="divide-y divide-line">
            {rateHistory.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                <span>
                  1 {r.fromCurrency} = <strong className="tabular-nums">{r.rate}</strong> {r.toCurrency}
                </span>
                <span className="flex items-center gap-2 text-xs text-muted">
                  {formatDate(r.date)} · {r.source}
                  <DeleteButton itemName={`el tipo de cambio ${r.fromCurrency}→${r.toCurrency} del ${r.date}`} action={deleteEntity.bind(null, "exchangeRate", tripId, r.id, null)} />
                </span>
              </div>
            ))}
          </Card>
        )}
      </section>
    </div>
  );
}

function Total({ label, value, hint, tone }: { label: string; value: string; hint: string; tone?: "success" | "warning" | "danger" }) {
  const color = tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : tone === "danger" ? "text-danger" : "";
  return (
    <Card className="p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className={cx("mt-1 text-xl font-semibold tabular-nums", color)}>{value}</p>
      <p className="mt-0.5 text-xs text-muted">{hint}</p>
    </Card>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cx("inline-block h-2.5 w-2.5 rounded-sm", className)} /> {label}
    </span>
  );
}

function BreakdownCard({ title, rows, total, money }: { title: string; rows: { label: string; bucket: Bucket }[]; total: number; money: (v: number) => string }) {
  const sorted = rows
    .map((r) => ({ ...r, sum: r.bucket.paid + r.bucket.pending + r.bucket.planned }))
    .filter((r) => r.sum > 0)
    .sort((a, b) => b.sum - a.sum);
  const max = Math.max(...sorted.map((r) => r.sum), 1);
  return (
    <Card className="p-4">
      <p className="mb-3 text-sm font-medium">{title}</p>
      <ul className="space-y-2.5">
        {sorted.map((r) => (
          <li key={r.label}>
            <div className="flex justify-between gap-2 text-sm">
              <span>{r.label}</span>
              <span className="tabular-nums">
                {money(r.sum)} <span className="text-xs text-muted">({total > 0 ? Math.round((r.sum / total) * 100) : 0}%)</span>
              </span>
            </div>
            <div className="mt-1 flex h-2 overflow-hidden rounded-full bg-surface-2" style={{ width: `${(r.sum / max) * 100}%` }}>
              <div className="bg-success" style={{ width: `${(r.bucket.paid / r.sum) * 100}%` }} />
              <div className="bg-warning" style={{ width: `${(r.bucket.pending / r.sum) * 100}%` }} />
              <div className="bg-muted/40" style={{ width: `${(r.bucket.planned / r.sum) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
