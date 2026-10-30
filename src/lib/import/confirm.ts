import { insertRows, selectAll, selectOne, updateRows } from "../db";
import type { FormState } from "../forms";
import { minorToInput, parseAmount } from "../domain/money";
import { saveEntity, saveExpense } from "../api";
import { notifyDataChanged } from "../hooks";
import type { Traveler, Trip } from "../types";

type ImportKind = "flight" | "lodging" | "transport" | "activity";

const EXPENSE_CATEGORY_BY_KIND: Record<ImportKind, string> = {
  flight: "vuelos",
  lodging: "alojamiento",
  transport: "transporte",
  activity: "actividades",
};

const BAGGAGE_CATEGORIES = ["personal", "cabina", "facturado", "adicional"];

function str(fd: FormData, name: string): string {
  const v = fd.get(name);
  return typeof v === "string" ? v.trim() : "";
}

/**
 * Guarda un elemento extraído DESPUÉS de que el usuario lo haya revisado: crea la reserva,
 * su equipaje (vuelos), enlaza el documento y, si se pidió, registra el gasto.
 */
export async function confirmImportItem(
  tripId: string,
  kind: ImportKind,
  documentId: string | null,
  _prev: FormState,
  fd: FormData,
): Promise<FormState> {
  const trip = await selectOne<Trip>("trip", { id: tripId });
  if (!trip) return { ok: false, error: "Viaje no encontrado" };

  const createExpense = fd.get("createExpense") === "on";
  const currency = (str(fd, "currency") || trip.baseCurrency).toUpperCase();
  if (createExpense) {
    if (!str(fd, "priceMinor")) return { ok: false, error: "Para registrar el gasto indica el precio.", fieldErrors: { priceMinor: "Indica el precio" } };
    if (currency !== trip.baseCurrency) {
      const rate = Number(str(fd, "expenseRate").replace(",", "."));
      if (!Number.isFinite(rate) || rate <= 0) {
        return { ok: false, error: `Indica el tipo de cambio ${currency} → ${trip.baseCurrency} para registrar el gasto.`, fieldErrors: { expenseRate: "Obligatorio" } };
      }
    }
  }

  const saved = await saveEntity(kind, tripId, null, null, null, fd);
  if (!saved?.ok || !saved.savedId) return saved;
  const id = saved.savedId;

  try {
    if (kind === "flight") {
      const count = Number(str(fd, "baggageCount")) || 0;
      const rows: Record<string, unknown>[] = [];
      for (let i = 0; i < count; i++) {
        if (fd.get(`baggage_${i}_keep`) !== "on") continue;
        const category = str(fd, `baggage_${i}_category`);
        if (!BAGGAGE_CATEGORIES.includes(category)) continue;
        const num = (name: string) => {
          const raw = str(fd, `baggage_${i}_${name}`);
          const n = Number(raw.replace(",", "."));
          return raw && Number.isFinite(n) && n >= 0 ? n : null;
        };
        const qty = num("quantity");
        rows.push({
          tripId,
          flightId: id,
          category,
          quantity: qty === null ? null : Math.round(qty),
          maxWeightKg: num("maxWeightKg"),
          maxDimensions: str(fd, `baggage_${i}_maxDimensions`) || null,
          restrictions: str(fd, `baggage_${i}_notes`) || null,
        });
      }
      await insertRows("baggage", rows);
    }

    // El documento original queda asociado a la primera reserva que se confirma.
    if (documentId) await updateRows("document", { id: documentId, tripId, linkedId: null }, { linkedType: kind, linkedId: id });
  } catch (e) {
    console.error(e);
    notifyDataChanged();
    return { ok: true, savedId: id, error: "La reserva se guardó, pero no su equipaje o el enlace al documento. Revísalo en la sección correspondiente." };
  }

  if (createExpense) {
    const priceMinor = parseAmount(str(fd, "priceMinor"), currency);
    const travelers = await selectAll<Traveler>("traveler", { tripId });
    const efd = new FormData();
    efd.set("description", str(fd, "expenseDescription") || "Reserva importada");
    efd.set("category", EXPENSE_CATEGORY_BY_KIND[kind]);
    efd.set("amount", minorToInput(priceMinor, currency));
    efd.set("currency", currency);
    efd.set("exchangeRate", str(fd, "expenseRate") || "1");
    efd.set("status", str(fd, "expenseStatus") || "pendiente");
    efd.set("paidAmount", str(fd, "expensePaid"));
    efd.set("paidByTravelerId", str(fd, "expensePaidBy"));
    efd.set("date", str(fd, "expenseDate"));
    efd.set("sourceType", kind);
    efd.set("sourceId", id);
    efd.set("splitMode", "igual");
    if (str(fd, "destinationId")) efd.set("destinationId", str(fd, "destinationId"));
    for (const t of travelers) efd.append("participants", t.id);
    const expense = await saveExpense(tripId, null, null, efd);
    if (!expense?.ok) {
      return { ok: true, savedId: id, error: `La reserva se guardó, pero el gasto no: ${expense?.error ?? "error desconocido"}. Regístralo en Finanzas.` };
    }
  }

  notifyDataChanged();
  return { ok: true, savedId: id };
}
