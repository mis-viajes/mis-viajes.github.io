import { toMajor } from "./domain/money";
import type { TripBundle } from "./domain/types";
import { EXPENSE_CATEGORY, EXPENSE_STATUS } from "./labels";

/** CSV de los gastos del viaje (separador ";" y BOM para que Excel lo abra bien). */
export function expensesCsv({ trip, expenses, travelers, destinations }: TripBundle): string {
  const name = (id: string | null) => travelers.find((t) => t.id === id)?.name ?? "";
  const city = (id: string | null) => destinations.find((d) => d.id === id)?.city ?? "";
  const base = trip.baseCurrency;
  const num = (v: number) => String(v).replace(".", ",");
  const header = [
    "Fecha",
    "Descripción",
    "Categoría",
    "Ciudad",
    "Importe",
    "Moneda",
    "Tipo de cambio",
    `Importe (${base})`,
    "Estado",
    "Pagado (moneda original)",
    "Pagado por",
    "Método de pago",
    ...travelers.map((t) => `Parte ${t.name} (${base})`),
    "Notas",
  ];
  const rows = expenses.map((e) => [
    e.date ?? "",
    e.description,
    EXPENSE_CATEGORY[e.category] ?? e.category,
    city(e.destinationId),
    num(toMajor(e.amountMinor, e.currency)),
    e.currency,
    num(e.exchangeRate),
    num(toMajor(e.amountBaseMinor, base)),
    EXPENSE_STATUS[e.status] ?? e.status,
    e.status === "pagado" ? num(toMajor(e.amountMinor, e.currency)) : e.paidMinor ? num(toMajor(e.paidMinor, e.currency)) : "",
    name(e.paidByTravelerId),
    e.paymentMethod ?? "",
    ...travelers.map((t) => {
      const sh = e.shares.find((x) => x.travelerId === t.id);
      return sh ? num(toMajor(sh.shareBaseMinor, base)) : "";
    }),
    e.notes ?? "",
  ]);
  const escape = (v: string) => (/[";\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return "﻿" + [header, ...rows].map((r) => r.map((c) => escape(String(c))).join(";")).join("\r\n");
}

export function downloadText(content: string, fileName: string, type: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(a.href);
}
