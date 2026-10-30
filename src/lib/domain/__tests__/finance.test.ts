import { describe, expect, it } from "vitest";
import type { Expense, Repayment, Traveler } from "../../types";
import { settle, summarizeFinances, type ExpenseWithShares } from "../finance";

const t = (id: string): Traveler => ({ id, tripId: "t", name: id.toUpperCase(), color: null, createdAt: "", updatedAt: "" });
const A = t("a");
const B = t("b");
const C = t("c");

function expense(over: Partial<Expense>, shares: [string, number][]): ExpenseWithShares {
  const base: Expense = {
    id: Math.random().toString(),
    tripId: "t",
    destinationId: null,
    description: "x",
    category: "otros",
    date: null,
    amountMinor: 0,
    currency: "CLP",
    exchangeRate: 1,
    amountBaseMinor: 0,
    status: "pagado",
    paidMinor: null,
    paidByTravelerId: null,
    paymentMethod: null,
    splitMode: "igual",
    sourceType: null,
    sourceId: null,
    shares: [],
    notes: null,
    createdAt: "",
    updatedAt: "",
  };
  const e = { ...base, ...over };
  return { ...e, shares: shares.map(([travelerId, shareBaseMinor]) => ({ travelerId, shareBaseMinor })) };
}

describe("summarizeFinances", () => {
  it("separa pagado, pendiente y previsto", () => {
    const f = summarizeFinances(
      [
        expense({ amountMinor: 1000, amountBaseMinor: 1000, status: "pagado", paidByTravelerId: "a" }, [["a", 500], ["b", 500]]),
        expense({ amountMinor: 600, amountBaseMinor: 600, status: "pendiente" }, [["a", 300], ["b", 300]]),
        expense({ amountMinor: 400, amountBaseMinor: 400, status: "previsto" }, [["a", 200], ["b", 200]]),
      ],
      [A, B],
      "CLP",
      2500,
    );
    expect(f.totals).toMatchObject({ paid: 1000, pending: 600, planned: 400, committed: 1600, projected: 2000 });
    expect(f.budgetRemaining).toBe(500);
  });

  it("calcula el pago parcial con el tipo de cambio congelado", () => {
    // 420 EUR a 1000 CLP/EUR, pagados 120 EUR.
    const f = summarizeFinances(
      [expense({ amountMinor: 42000, currency: "EUR", exchangeRate: 1000, amountBaseMinor: 420000, status: "parcial", paidMinor: 12000, paidByTravelerId: "b" }, [["a", 210000], ["b", 210000]])],
      [A, B],
      "CLP",
      null,
    );
    expect(f.totals.paid).toBe(120000);
    expect(f.totals.pending).toBe(300000);
    // Solo cuenta lo pagado: A debe la mitad de 120.000 a B.
    expect(f.settlements).toHaveLength(1);
    expect(f.settlements[0]).toMatchObject({ from: A, to: B, amount: 60000 });
  });

  it("saldos de quién pagó cuánto", () => {
    const f = summarizeFinances(
      [
        expense({ amountMinor: 900, amountBaseMinor: 900, paidByTravelerId: "a" }, [["a", 300], ["b", 300], ["c", 300]]),
        expense({ amountMinor: 300, amountBaseMinor: 300, paidByTravelerId: "b" }, [["a", 100], ["b", 100], ["c", 100]]),
      ],
      [A, B, C],
      "CLP",
      null,
    );
    const byId = Object.fromEntries(f.balances.map((x) => [x.traveler.id, x]));
    expect(byId.a.balance).toBe(500);
    expect(byId.b.balance).toBe(-100);
    expect(byId.c.balance).toBe(-400);
    const total = f.settlements.reduce((s, x) => s + x.amount, 0);
    expect(total).toBe(500);
  });
});

describe("settle", () => {
  it("devuelve transferencias que dejan todo a cero", () => {
    const res = settle([
      { traveler: A, balance: 70 },
      { traveler: B, balance: -50 },
      { traveler: C, balance: -20 },
    ]);
    expect(res).toEqual([
      { from: B, to: A, amount: 50 },
      { from: C, to: A, amount: 20 },
    ]);
  });
});

describe("pagos entre viajeros", () => {
  const a = { id: "a", name: "A" } as Traveler;
  const c = { id: "c", name: "C" } as Traveler;
  const gasto = {
    id: "e", status: "pagado", category: "otros", currency: "CLP", exchangeRate: 1, amountMinor: 1000, amountBaseMinor: 1000, paidMinor: null, destinationId: null,
    paidByTravelerId: "a", shares: [{ travelerId: "a", shareBaseMinor: 500 }, { travelerId: "c", shareBaseMinor: 500 }],
  } as ExpenseWithShares;
  const pago = (amountBaseMinor: number) => ({ id: "r", fromTravelerId: "c", toTravelerId: "a", amountBaseMinor }) as Repayment;

  it("un pago completo deja las cuentas en cero sin cambiar el total", () => {
    const f = summarizeFinances([gasto], [a, c], "CLP", null, [pago(500)]);
    expect(f.balances.map((b) => b.balance)).toEqual([0, 0]);
    expect(f.settlements).toHaveLength(0);
    expect(f.totals.paid).toBe(1000);
  });

  it("un pago parcial deja el resto por saldar", () => {
    expect(summarizeFinances([gasto], [a, c], "CLP", null, [pago(200)]).settlements[0].amount).toBe(300);
  });
});
