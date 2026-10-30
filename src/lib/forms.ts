import { z } from "zod";
import type { EntityDef, FieldDef } from "./entities";
import { CURRENCIES, parseAmount } from "./domain/money";

export type FormState = { ok: boolean; error?: string; fieldErrors?: Record<string, string>; savedId?: string } | null;

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida");
const datetimeSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Fecha y hora no válidas");
const timeSchema = z.string().regex(/^\d{2}:\d{2}$/, "Hora no válida");
const urlSchema = z.url({ protocol: /^https?$/, error: "Debe ser un enlace http(s) válido" });

function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function str(fd: FormData, name: string): string {
  const v = fd.get(name);
  return typeof v === "string" ? v.trim() : "";
}

/** Convierte y valida un formulario según su definición. Devuelve valores listos para la base de datos. */
export function parseEntityForm(def: EntityDef, fd: FormData) {
  const values: Record<string, unknown> = {};
  const errors: Record<string, string> = {};

  const check = (field: FieldDef, raw: string, schema: z.ZodType<string>) => {
    const r = schema.safeParse(raw);
    if (!r.success) errors[field.name] = r.error.issues[0]?.message ?? "Valor no válido";
    return r.success ? r.data : null;
  };

  for (const field of def.fields) {
    if (field.type === "location") {
      for (const [col, min, max] of [
        [field.latName!, -90, 90],
        [field.lngName!, -180, 180],
      ] as const) {
        const raw = str(fd, col).replace(",", ".");
        if (!raw) {
          values[col] = null;
          continue;
        }
        const n = Number(raw);
        if (!Number.isFinite(n) || n < min || n > max) errors[field.name] = "Coordenadas no válidas";
        else values[col] = n;
      }
      continue;
    }

    if (field.type === "checkbox") {
      values[field.name] = fd.get(field.name) === "on" || fd.get(field.name) === "true";
      continue;
    }

    const raw = str(fd, field.name);
    if (!raw) {
      if (field.required) errors[field.name] = "Campo obligatorio";
      values[field.name] = null;
      continue;
    }

    switch (field.type) {
      case "number":
      case "integer":
      case "rating": {
        const n = Number(raw.replace(",", "."));
        if (!Number.isFinite(n) || n < 0) errors[field.name] = "Número no válido";
        else if (field.type === "rating" && (n < 1 || n > 5)) errors[field.name] = "Entre 1 y 5";
        else values[field.name] = field.type === "number" ? n : Math.round(n);
        break;
      }
      case "money": {
        const currency = str(fd, field.currencyField ?? "currency") || "CLP";
        const minor = parseAmount(raw, currency);
        if (minor === null || minor < 0) errors[field.name] = "Importe no válido";
        else values[field.name] = minor;
        break;
      }
      case "date":
        values[field.name] = check(field, raw, dateSchema);
        break;
      case "datetime":
        values[field.name] = check(field, raw.slice(0, 16), datetimeSchema);
        break;
      case "time":
        values[field.name] = check(field, raw.slice(0, 5), timeSchema);
        break;
      case "url":
        values[field.name] = check(field, raw, urlSchema);
        break;
      case "currency": {
        const cur = raw.toUpperCase();
        if (!(CURRENCIES as readonly string[]).includes(cur)) errors[field.name] = "Moneda no soportada";
        else values[field.name] = cur;
        break;
      }
      case "timezone":
        if (!isValidTimeZone(raw)) errors[field.name] = "Zona horaria no válida (ej.: Europe/Madrid)";
        else values[field.name] = raw;
        break;
      case "select":
        if (field.options && !field.options.some((o) => o.value === raw)) errors[field.name] = "Opción no válida";
        else values[field.name] = raw;
        break;
      default:
        values[field.name] = raw.slice(0, 5000);
    }
  }

  // Coherencia de fechas habituales.
  const pairs: [string, string, string][] = [
    ["startDate", "endDate", "La fecha de término debe ser posterior al inicio"],
    ["arrivalDate", "departureDate", "La salida debe ser posterior a la llegada"],
    ["checkInDate", "checkOutDate", "El check-out debe ser posterior al check-in"],
  ];
  for (const [a, b, msg] of pairs) {
    if (typeof values[a] === "string" && typeof values[b] === "string" && (values[b] as string) < (values[a] as string)) {
      errors[b] = msg;
    }
  }
  if (typeof values.startTime === "string" && typeof values.endTime === "string" && values.endTime < values.startTime) {
    errors.endTime = "La hora de término debe ser posterior al inicio";
  }

  return { values, errors, ok: Object.keys(errors).length === 0 };
}
