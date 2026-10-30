import type { Expense, Repayment, Traveler } from "../types";
import { convertMinor } from "./money";

/** Los gastos guardan sus partes en la propia fila (columna jsonb `shares`). */
export type ExpenseWithShares = Expense;

export type Bucket = { paid: number; pending: number; planned: number };

const emptyBucket = (): Bucket => ({ paid: 0, pending: 0, planned: 0 });

/** Parte ya pagada de un gasto, en moneda base (usa el tipo de cambio congelado del gasto). */
export function paidBase(e: Expense, base: string): number {
  if (e.status === "pagado") return e.amountBaseMinor;
  if (e.status === "parcial" && e.paidMinor) {
    return Math.min(e.amountBaseMinor, convertMinor(e.paidMinor, e.currency, base, e.exchangeRate));
  }
  return 0;
}

export function bucketOf(e: Expense, base: string): Bucket {
  const paid = paidBase(e, base);
  if (e.status === "previsto") return { paid: 0, pending: 0, planned: e.amountBaseMinor };
  return { paid, pending: e.amountBaseMinor - paid, planned: 0 };
}

function add(target: Bucket, b: Bucket) {
  target.paid += b.paid;
  target.pending += b.pending;
  target.planned += b.planned;
}

export type TravelerBalance = {
  traveler: Traveler;
  /** Lo que esta persona ha pagado de su bolsillo. */
  paid: number;
  /** Lo que le corresponde de lo ya pagado. */
  shareOfPaid: number;
  /** Devuelto a otros viajeros menos lo recibido de ellos. */
  repaid: number;
  /** paid - shareOfPaid + repaid: positivo = le deben, negativo = debe. */
  balance: number;
  /** Lo que le corresponde del total previsto del viaje (pagado + pendiente + previsto). */
  shareTotal: number;
};

export type Settlement = { from: Traveler; to: Traveler; amount: number };

export type FinanceSummary = {
  totals: Bucket & { committed: number; projected: number };
  budget: number | null;
  budgetRemaining: number | null;
  byCategory: Record<string, Bucket>;
  byDestination: Record<string, Bucket>;
  balances: TravelerBalance[];
  settlements: Settlement[];
  paidWithoutPayer: number;
};

export function summarizeFinances(
  expenses: ExpenseWithShares[],
  travelers: Traveler[],
  base: string,
  budget: number | null,
  repayments: Repayment[] = [],
): FinanceSummary {
  const totals = emptyBucket();
  const byCategory: Record<string, Bucket> = {};
  const byDestination: Record<string, Bucket> = {};
  const paidBy = new Map<string, number>();
  const shareOfPaid = new Map<string, number>();
  const shareTotal = new Map<string, number>();
  let paidWithoutPayer = 0;

  for (const e of expenses) {
    const b = bucketOf(e, base);
    add(totals, b);
    add((byCategory[e.category] ??= emptyBucket()), b);
    add((byDestination[e.destinationId ?? ""] ??= emptyBucket()), b);

    if (b.paid > 0) {
      if (e.paidByTravelerId) paidBy.set(e.paidByTravelerId, (paidBy.get(e.paidByTravelerId) ?? 0) + b.paid);
      else paidWithoutPayer += b.paid;
    }
    const ratio = e.amountBaseMinor > 0 ? b.paid / e.amountBaseMinor : 0;
    for (const s of e.shares) {
      shareTotal.set(s.travelerId, (shareTotal.get(s.travelerId) ?? 0) + s.shareBaseMinor);
      if (ratio > 0 && e.paidByTravelerId) {
        shareOfPaid.set(s.travelerId, (shareOfPaid.get(s.travelerId) ?? 0) + Math.round(s.shareBaseMinor * ratio));
      }
    }
  }

  const balances = travelers.map((t) => {
    const paid = paidBy.get(t.id) ?? 0;
    const share = shareOfPaid.get(t.id) ?? 0;
    const repaid = repayments.reduce((sum, r) => sum + (r.fromTravelerId === t.id ? r.amountBaseMinor : 0) - (r.toTravelerId === t.id ? r.amountBaseMinor : 0), 0);
    return { traveler: t, paid, shareOfPaid: share, repaid, balance: paid - share + repaid, shareTotal: shareTotal.get(t.id) ?? 0 };
  });

  const committed = totals.paid + totals.pending;
  const projected = committed + totals.planned;
  return {
    totals: { ...totals, committed, projected },
    budget,
    budgetRemaining: budget === null ? null : budget - projected,
    byCategory,
    byDestination,
    balances,
    settlements: settle(balances),
    paidWithoutPayer,
  };
}

/** Transferencias mínimas (algoritmo voraz) para saldar las cuentas entre viajeros. */
export function settle(balances: Pick<TravelerBalance, "traveler" | "balance">[]): Settlement[] {
  const creditors = balances.filter((b) => b.balance > 0).map((b) => ({ ...b })).sort((a, b) => b.balance - a.balance);
  const debtors = balances.filter((b) => b.balance < 0).map((b) => ({ ...b, balance: -b.balance })).sort((a, b) => b.balance - a.balance);
  const result: Settlement[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(debtors[i].balance, creditors[j].balance);
    if (amount > 0) result.push({ from: debtors[i].traveler, to: creditors[j].traveler, amount });
    debtors[i].balance -= amount;
    creditors[j].balance -= amount;
    if (debtors[i].balance === 0) i++;
    if (creditors[j].balance === 0) j++;
  }
  return result;
}
