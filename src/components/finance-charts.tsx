import type { Bucket, TravelerBalance } from "@/lib/domain/finance";
import { EXPENSE_CATEGORY } from "@/lib/labels";
import { Card } from "./ui";

/**
 * Color fijo por categoría (sigue a la categoría, no a su posición en el ranking).
 * Las categorías menos frecuentes se agrupan en «Otros».
 */
const CATEGORY_SLOT: Record<string, string> = {
  vuelos: "var(--color-series-1)",
  alojamiento: "var(--color-series-2)",
  transporte: "var(--color-series-3)",
  alimentacion: "var(--color-series-4)",
  restaurantes: "var(--color-series-5)",
  actividades: "var(--color-series-6)",
  compras: "var(--color-series-7)",
  equipaje: "var(--color-series-8)",
};
const CATEGORY_ORDER = Object.keys(CATEGORY_SLOT);

const sum = (b: Bucket) => b.paid + b.pending + b.planned;
const pct = (v: number, total: number) => (total > 0 ? Math.round((v / total) * 100) : 0);

/** Barra segmentada: en qué se va el dinero del viaje (pagado + pendiente + previsto). */
export function CategoryBar({ byCategory, money }: { byCategory: Record<string, Bucket>; money: (v: number) => string }) {
  const known = CATEGORY_ORDER.map((c) => ({ key: c, label: EXPENSE_CATEGORY[c], value: byCategory[c] ? sum(byCategory[c]) : 0, color: CATEGORY_SLOT[c] }));
  const other = Object.entries(byCategory)
    .filter(([c]) => !CATEGORY_SLOT[c])
    .reduce((acc, [, b]) => acc + sum(b), 0);
  const parts = [...known, { key: "otros", label: "Otros", value: other, color: "var(--color-series-other)" }].filter((p) => p.value > 0);
  const total = parts.reduce((a, p) => a + p.value, 0);
  if (total === 0) return null;

  return (
    <Card className="p-4">
      <p className="text-sm font-medium">En qué se va el dinero</p>
      <p className="text-xs text-muted">Total del viaje {money(total)} · pagado, pendiente y previsto</p>
      <div className="mt-3 flex h-9 w-full gap-0.5 overflow-hidden rounded-lg" role="img" aria-label="Reparto del gasto por categoría">
        {parts.map((p) => (
          <div
            key={p.key}
            className="h-full transition-opacity first:rounded-l-lg last:rounded-r-lg hover:opacity-80"
            style={{ width: `${(p.value / total) * 100}%`, background: p.color, minWidth: 4 }}
            title={`${p.label}: ${money(p.value)} (${pct(p.value, total)}%)`}
          />
        ))}
      </div>
      <ul className="mt-3 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
        {parts.map((p) => (
          <li key={p.key} className="flex items-center gap-2 text-sm">
            <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: p.color }} aria-hidden />
            <span className="min-w-0 flex-1 truncate">{p.label}</span>
            <span className="tabular-nums">{money(p.value)}</span>
            <span className="w-10 text-right text-xs tabular-nums text-muted">{pct(p.value, total)}%</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** Barras por persona: lo que ha pagado frente a lo que le corresponde del total del viaje. */
export function PersonBars({ balances, money }: { balances: TravelerBalance[]; money: (v: number) => string }) {
  const max = Math.max(...balances.flatMap((b) => [b.paid, b.shareTotal]), 1);
  if (balances.length === 0) return null;
  const series = [
    { key: "paid", label: "Ha pagado", color: "var(--color-series-1)" },
    { key: "shareTotal", label: "Le corresponde del total", color: "var(--color-series-2)" },
  ] as const;
  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">Por persona</p>
        <ul className="flex flex-wrap gap-4 text-xs text-muted">
          {series.map((s) => (
            <li key={s.key} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} aria-hidden /> {s.label}
            </li>
          ))}
        </ul>
      </div>
      <ul className="mt-3 space-y-4">
        {balances.map((b) => (
          <li key={b.traveler.id}>
            <p className="mb-1.5 text-sm font-medium">{b.traveler.name}</p>
            {series.map((s) => (
              <div key={s.key} className="mb-1 flex items-center gap-2" title={`${s.label}: ${money(b[s.key])}`}>
                <div className="h-2.5 flex-1 rounded-full bg-surface-2">
                  <div className="h-full rounded-full" style={{ width: `${(b[s.key] / max) * 100}%`, background: s.color, minWidth: b[s.key] > 0 ? 4 : 0 }} />
                </div>
                <span className="w-28 text-right text-xs tabular-nums">{money(b[s.key])}</span>
              </div>
            ))}
          </li>
        ))}
      </ul>
    </Card>
  );
}
