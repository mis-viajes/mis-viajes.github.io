import { fromZonedTime } from "date-fns-tz";
import { addDays, addMonths, differenceInCalendarDays, endOfMonth, endOfWeek, format, parseISO, startOfMonth, startOfWeek } from "date-fns";
import { es } from "date-fns/locale";

/** Fecha local de hoy en formato YYYY-MM-DD. */
export function todayISO(now: Date = new Date()): string {
  return format(now, "yyyy-MM-dd");
}

export function tripDays(startDate: string, endDate: string): number {
  return differenceInCalendarDays(parseISO(endDate), parseISO(startDate)) + 1;
}

export function nightsBetween(checkIn: string | null, checkOut: string | null): number | null {
  if (!checkIn || !checkOut) return null;
  const n = differenceInCalendarDays(parseISO(checkOut), parseISO(checkIn));
  return n >= 0 ? n : null;
}

export function daysUntil(date: string, today: string): number {
  return differenceInCalendarDays(parseISO(date), parseISO(today));
}

/** Lista de fechas YYYY-MM-DD entre dos fechas, ambas incluidas. */
export function dateRange(startDate: string, endDate: string): string[] {
  const days = tripDays(startDate, endDate);
  if (days <= 0 || days > 400) return [];
  const start = parseISO(startDate);
  return Array.from({ length: days }, (_, i) => format(addDays(start, i), "yyyy-MM-dd"));
}

/** Suma días a una fecha YYYY-MM-DD. */
export function shiftDate(date: string, days: number): string {
  return format(addDays(parseISO(date), days), "yyyy-MM-dd");
}

/** Primer día del mes que está `months` meses después de `date`. */
export function shiftMonth(date: string, months: number): string {
  return format(startOfMonth(addMonths(parseISO(date), months)), "yyyy-MM-dd");
}

/** Los 7 días (lunes a domingo) de la semana que contiene `date`. */
export function weekDays(date: string): string[] {
  const start = startOfWeek(parseISO(date), { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, i) => format(addDays(start, i), "yyyy-MM-dd"));
}

/** Semanas completas (de lunes a domingo) que cubren el mes de `date`. */
export function monthWeeks(date: string): string[][] {
  const month = parseISO(date);
  const first = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const last = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
  const weeks = Math.round((differenceInCalendarDays(last, first) + 1) / 7);
  return Array.from({ length: weeks }, (_, i) => weekDays(format(addDays(first, i * 7), "yyyy-MM-dd")));
}

export type TripPhase = "futuro" | "en_curso" | "finalizado" | "cancelado";

export function tripPhase(trip: { startDate: string; endDate: string; status: string }, today: string): TripPhase {
  if (trip.status === "cancelado") return "cancelado";
  if (today < trip.startDate) return "futuro";
  if (today > trip.endDate) return "finalizado";
  return "en_curso";
}

/**
 * Convierte una fecha-hora local ("YYYY-MM-DDTHH:mm") con zona IANA a instante UTC.
 * Sin zona, se interpreta como UTC y se marca como aproximado.
 */
export function localToInstant(local: string | null, tz: string | null): { date: Date; exact: boolean } | null {
  if (!local) return null;
  const normalized = local.length === 10 ? `${local}T00:00` : local;
  try {
    if (tz) return { date: fromZonedTime(normalized, tz), exact: true };
    return { date: new Date(`${normalized}:00Z`), exact: false };
  } catch {
    return null;
  }
}

export function minutesBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 60000);
}

export function formatDuration(minutes: number | null): string {
  if (minutes === null || !Number.isFinite(minutes)) return "—";
  const sign = minutes < 0 ? "-" : "";
  const m = Math.abs(minutes);
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${sign}${r} min`;
  return `${sign}${h} h${r ? ` ${r} min` : ""}`;
}

export function formatDate(date: string | null | undefined, pattern = "d MMM yyyy"): string {
  if (!date) return "—";
  try {
    return format(parseISO(date), pattern, { locale: es });
  } catch {
    return date;
  }
}

export function formatDateTimeLocal(local: string | null | undefined): string {
  if (!local) return "—";
  return formatDate(local, local.length > 10 ? "EEE d MMM, HH:mm" : "EEE d MMM");
}

export function formatDayHeading(date: string): string {
  return formatDate(date, "EEEE d 'de' MMMM");
}

export function datePart(local: string | null | undefined): string | null {
  return local ? local.slice(0, 10) : null;
}

export function timePart(local: string | null | undefined): string | null {
  return local && local.length >= 16 ? local.slice(11, 16) : null;
}
