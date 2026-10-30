import type { PostgrestError } from "@supabase/supabase-js";
import { supabase } from "./supabase";

/** Nombre de la tabla de cada entidad en Supabase. */
export const TABLE = {
  trip: "tm_trips",
  traveler: "tm_travelers",
  destination: "tm_destinations",
  flight: "tm_flights",
  baggage: "tm_baggage_allowances",
  lodging: "tm_lodgings",
  transport: "tm_transports",
  activity: "tm_activities",
  restaurant: "tm_restaurants",
  document: "tm_documents",
  expense: "tm_expenses",
  exchangeRate: "tm_exchange_rates",
  checklist: "tm_checklist_items",
  repayment: "tm_repayments",
} as const;

export type TableKey = keyof typeof TABLE;

const toSnake = (k: string) => k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
const toCamel = (k: string) => k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

export function toRow(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined).map(([k, v]) => [toSnake(k), v]));
}

export function fromRow<T>(row: Record<string, unknown>): T {
  return Object.fromEntries(Object.entries(row).filter(([k]) => k !== "user_id").map(([k, v]) => [toCamel(k), v])) as T;
}

/** Error de base de datos con mensaje en español. */
export class DbError extends Error {
  readonly code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.code = code;
  }
}

/** Códigos que indican que las tablas tm_* todavía no existen en Supabase. */
export function isMissingSchema(e: unknown): boolean {
  const code = (e as { code?: string })?.code;
  return code === "PGRST205" || code === "42P01" || code === "PGRST106";
}

function fail(error: PostgrestError): never {
  throw new DbError(error.message, error.code);
}

type Filters = Record<string, string | string[] | null>;

// El tipado completo del constructor de consultas de supabase-js es demasiado profundo para TypeScript aquí.
function applyFilters<Q>(query: Q, filters: Filters): Q {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q = query as any;
  for (const [k, v] of Object.entries(filters)) {
    const col = toSnake(k);
    q = v === null ? q.is(col, null) : Array.isArray(v) ? q.in(col, v) : q.eq(col, v);
  }
  return q as Q;
}

/** Lee todas las filas que cumplen los filtros (pagina de 1000 en 1000). */
export async function selectAll<T>(table: TableKey, filters: Filters = {}, order: [string, boolean][] = []): Promise<T[]> {
  const PAGE = 1000;
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    let q = applyFilters(supabase.from(TABLE[table]).select("*"), filters);
    for (const [col, asc] of order) q = q.order(toSnake(col), { ascending: asc, nullsFirst: false });
    const { data, error } = await q.range(from, from + PAGE - 1);
    if (error) fail(error);
    out.push(...(data ?? []).map((r) => fromRow<T>(r)));
    if (!data || data.length < PAGE) return out;
  }
}

export async function selectOne<T>(table: TableKey, filters: Filters): Promise<T | null> {
  const { data, error } = await applyFilters(supabase.from(TABLE[table]).select("*"), filters).maybeSingle();
  if (error) fail(error);
  return data ? fromRow<T>(data) : null;
}

export async function insertRow<T>(table: TableKey, values: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.from(TABLE[table]).insert(toRow(values)).select("*").single();
  if (error) fail(error);
  return fromRow<T>(data);
}

export async function insertRows(table: TableKey, values: Record<string, unknown>[]): Promise<void> {
  if (values.length === 0) return;
  const { error } = await supabase.from(TABLE[table]).insert(values.map(toRow));
  if (error) fail(error);
}

export async function updateRows(table: TableKey, filters: Filters, values: Record<string, unknown>): Promise<void> {
  const { error } = await applyFilters(supabase.from(TABLE[table]).update(toRow(values)), filters);
  if (error) fail(error);
}

export async function deleteRows(table: TableKey, filters: Filters): Promise<void> {
  if (Object.keys(filters).length === 0) throw new Error("Borrado sin filtros no permitido");
  const { error } = await applyFilters(supabase.from(TABLE[table]).delete(), filters);
  if (error) fail(error);
}
