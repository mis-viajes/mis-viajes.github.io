/** Utilidades monetarias. Los importes se manejan siempre como enteros en unidad mínima. */

export const CURRENCIES = ["CLP", "EUR", "USD", "GBP", "BRL", "ARS", "PEN", "MXN", "COP", "JPY", "CHF"] as const;
export const PRIMARY_CURRENCIES = ["CLP", "EUR", "USD"] as const;

const ZERO_DECIMALS = new Set(["CLP", "JPY", "KRW", "PYG", "ISK"]);

export function currencyDecimals(currency: string): number {
  return ZERO_DECIMALS.has(currency.toUpperCase()) ? 0 : 2;
}

/**
 * Interpreta importes escritos a mano: "1.234,56" | "1,234.56" | "1234.5" | "45.000" → unidad mínima.
 * Con un solo tipo de separador, si va seguido de exactamente 3 dígitos (o se repite) es de miles.
 * Devuelve null si no es un número válido.
 */
export function parseAmount(input: string | number | null | undefined, currency: string): number | null {
  if (input === null || input === undefined) return null;
  const factor = 10 ** currencyDecimals(currency);
  if (typeof input === "number") return Number.isFinite(input) ? Math.round(input * factor) : null;
  let s = input.replace(/[^\d.,-]/g, "");
  if (!/\d/.test(s)) return null;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > -1 && lastDot > -1) {
    const decimalSep = lastComma > lastDot ? "," : ".";
    const thousandsSep = decimalSep === "," ? "." : ",";
    s = s.split(thousandsSep).join("").replace(decimalSep, ".");
  } else if (lastComma > -1 || lastDot > -1) {
    const sep = lastComma > -1 ? "," : ".";
    const occurrences = s.split(sep).length - 1;
    const trailing = s.length - s.lastIndexOf(sep) - 1;
    s = occurrences > 1 || trailing === 3 ? s.split(sep).join("") : s.replace(sep, ".");
  }
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * factor) : null;
}

export function toMajor(minor: number, currency: string): number {
  return minor / 10 ** currencyDecimals(currency);
}

/** Valor para inputs de formulario (sin separadores de miles). */
export function minorToInput(minor: number | null | undefined, currency: string | null | undefined): string {
  if (minor === null || minor === undefined) return "";
  const cur = currency ?? "CLP";
  return toMajor(minor, cur).toFixed(currencyDecimals(cur));
}

export function formatMoney(minor: number | null | undefined, currency: string | null | undefined): string {
  if (minor === null || minor === undefined) return "—";
  const cur = (currency ?? "CLP").toUpperCase();
  const decimals = currencyDecimals(cur);
  try {
    return new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: cur,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(toMajor(minor, cur));
  } catch {
    return `${toMajor(minor, cur).toFixed(decimals)} ${cur}`;
  }
}

/**
 * Convierte a la moneda base. `rate` = unidades de moneda base por 1 unidad de la moneda original.
 */
export function convertMinor(amountMinor: number, from: string, to: string, rate: number): number {
  if (from.toUpperCase() === to.toUpperCase()) return amountMinor;
  return Math.round(toMajor(amountMinor, from) * rate * 10 ** currencyDecimals(to));
}

/** Reparte un total entero en partes iguales sin perder unidades por redondeo. */
export function splitEvenly(totalMinor: number, parts: number): number[] {
  if (parts <= 0) return [];
  const base = Math.trunc(totalMinor / parts);
  const remainder = totalMinor - base * parts;
  return Array.from({ length: parts }, (_, i) => base + (i < Math.abs(remainder) ? Math.sign(remainder) : 0));
}
