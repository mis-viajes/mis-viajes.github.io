import { deleteRows, insertRow, insertRows, selectAll, selectOne, updateRows, type TableKey } from "./db";
import { ENTITIES, type EntityName } from "./entities";
import { parseEntityForm, type FormState } from "./forms";
import { notifyDataChanged } from "./hooks";
import { convertMinor, parseAmount, splitEvenly } from "./domain/money";
import { EXPENSE_CATEGORY, EXPENSE_STATUS } from "./labels";
import { deleteFile, deleteTripFiles } from "./storage";
import type { Activity, Destination, DocumentRow, Expense, ExpenseShare, Restaurant, Traveler, Trip } from "./types";

/**
 * Mutaciones. Mantienen la firma (prev, FormData) => FormState de los formularios
 * para usarse con useActionState. La seguridad la garantiza Row Level Security en Supabase.
 */

const errorState = (e: unknown, fallback = "No se pudo guardar. Inténtalo de nuevo."): FormState => {
  console.error(e);
  const msg = e instanceof Error && /fetch|network/i.test(e.message) ? "Sin conexión con la base de datos. Revisa tu internet." : fallback;
  return { ok: false, error: msg };
};

async function getTrip(tripId: string): Promise<Trip> {
  const trip = await selectOne<Trip>("trip", { id: tripId });
  if (!trip) throw new Error("Viaje no encontrado");
  return trip;
}

const TRIP_TABLES: Partial<Record<EntityName, TableKey>> = {
  traveler: "traveler",
  destination: "destination",
  flight: "flight",
  lodging: "lodging",
  transport: "transport",
  activity: "activity",
  restaurant: "restaurant",
};

/** Crea o actualiza cualquier entidad declarada en ENTITIES. `parentId` = id del vuelo (equipaje). */
export async function saveEntity(
  entity: EntityName,
  tripId: string | null,
  id: string | null,
  parentId: string | null,
  _prev: FormState,
  fd: FormData,
): Promise<FormState> {
  const def = ENTITIES[entity];
  try {
    if (tripId && entity !== "trip" && def.fields.some((f) => f.name === "currency") && !fd.get("currency")) {
      fd.set("currency", (await getTrip(tripId)).baseCurrency);
    }
    const { values, errors, ok } = parseEntityForm(def, fd);
    if (!ok) return { ok: false, error: "Revisa los campos marcados", fieldErrors: errors };

    if (entity === "trip") {
      if (id) {
        await updateRows("trip", { id }, values);
        notifyDataChanged();
        return { ok: true, savedId: id };
      }
      const created = await insertRow<Trip>("trip", values);
      const owner = String(fd.get("ownerName") ?? "").trim();
      if (owner) await insertRow("traveler", { tripId: created.id, name: owner });
      notifyDataChanged();
      return { ok: true, savedId: created.id };
    }

    if (entity === "exchangeRate") {
      if (values.fromCurrency === values.toCurrency) {
        return { ok: false, error: "Las monedas deben ser distintas", fieldErrors: { toCurrency: "Elige otra moneda" } };
      }
      await insertRow("exchangeRate", values);
      notifyDataChanged();
      return { ok: true };
    }

    if (!tripId) return { ok: false, error: "Falta el viaje" };

    if (entity === "baggage") {
      if (!parentId) return { ok: false, error: "Falta el vuelo" };
      if (id) await updateRows("baggage", { id, flightId: parentId }, values);
      else await insertRow("baggage", { ...values, tripId, flightId: parentId });
      notifyDataChanged();
      return { ok: true };
    }

    const table = TRIP_TABLES[entity];
    if (!table) return { ok: false, error: "Entidad desconocida" };
    if (entity === "destination" && !id) {
      values.position = (await selectAll<Destination>("destination", { tripId })).length;
    }
    let savedId = id;
    if (id) await updateRows(table, { id, tripId }, values);
    else savedId = (await insertRow<{ id: string }>(table, { ...values, tripId })).id;
    notifyDataChanged();
    return { ok: true, savedId: savedId ?? undefined };
  } catch (e) {
    return errorState(e);
  }
}

export async function deleteEntity(entity: EntityName, tripId: string, id: string, parentId?: string | null) {
  if (entity === "trip") {
    await deleteTripFiles(id);
    await deleteRows("trip", { id });
  } else if (entity === "exchangeRate") {
    await deleteRows("exchangeRate", { id });
  } else if (entity === "baggage") {
    if (!parentId) throw new Error("Falta el vuelo");
    await deleteRows("baggage", { id, flightId: parentId });
  } else {
    const table = TRIP_TABLES[entity];
    if (!table) throw new Error("Entidad desconocida");
    if (entity === "traveler") {
      // Se quita al viajero de los repartos; la base de datos deja sin pagador sus gastos.
      const expenses = await selectAll<Expense>("expense", { tripId });
      for (const e of expenses.filter((x) => x.shares?.some((s) => s.travelerId === id))) {
        await updateRows("expense", { id: e.id }, { shares: e.shares.filter((s) => s.travelerId !== id) });
      }
    }
    await deleteRows(table, { id, tripId });
    if (entity !== "traveler" && entity !== "destination") {
      // Los gastos se conservan, pero dejan de apuntar a la reserva eliminada.
      await updateRows("expense", { tripId, sourceId: id }, { sourceType: null, sourceId: null });
    }
  }
  notifyDataChanged();
}

export async function moveDestination(tripId: string, id: string, direction: -1 | 1) {
  const list = await selectAll<Destination>("destination", { tripId }, [["position", true], ["arrivalDate", true]]);
  const index = list.findIndex((d) => d.id === id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= list.length) return;
  [list[index], list[target]] = [list[target], list[index]];
  await Promise.all(list.map((d, i) => (d.position === i ? null : updateRows("destination", { id: d.id }, { position: i }))));
  notifyDataChanged();
}

/** Duplica un viaje como plantilla: destinos, viajeros, actividades y restaurantes, sin reservas ni gastos. */
export async function duplicateTrip(tripId: string): Promise<string> {
  const trip = await getTrip(tripId);
  const created = await insertRow<Trip>("trip", {
    name: `${trip.name} (copia)`,
    description: trip.description,
    startDate: trip.startDate,
    endDate: trip.endDate,
    baseCurrency: trip.baseCurrency,
    budgetMinor: trip.budgetMinor,
    coverImage: trip.coverImage,
    notes: trip.notes,
  });
  const strip = <T extends { id: string; tripId: string; createdAt: string; updatedAt: string }>(row: T) => {
    const copy: Record<string, unknown> = { ...row, tripId: created.id };
    delete copy.id;
    delete copy.createdAt;
    delete copy.updatedAt;
    return copy;
  };
  const travelers = await selectAll<Traveler>("traveler", { tripId });
  await insertRows("traveler", travelers.map(strip));
  const destMap = new Map<string, string>();
  for (const d of await selectAll<Destination>("destination", { tripId })) {
    destMap.set(d.id, (await insertRow<Destination>("destination", strip(d))).id);
  }
  const remap = (id: string | null) => (id ? (destMap.get(id) ?? null) : null);
  const activities = await selectAll<Activity>("activity", { tripId });
  await insertRows(
    "activity",
    activities.map((a) => ({ ...strip(a), destinationId: remap(a.destinationId), bookingStatus: "idea", bookingCode: null })),
  );
  const restaurants = await selectAll<Restaurant>("restaurant", { tripId });
  await insertRows(
    "restaurant",
    restaurants.map((r) => ({
      ...strip(r),
      destinationId: remap(r.destinationId),
      reservedAt: null,
      listStatus: r.listStatus === "reservado" || r.listStatus === "visitado" ? "por_visitar" : r.listStatus,
    })),
  );
  notifyDataChanged();
  return created.id;
}

const COORD_COLUMNS: Record<string, [string, string][]> = {
  destination: [["lat", "lng"]],
  lodging: [["lat", "lng"]],
  activity: [["lat", "lng"]],
  restaurant: [["lat", "lng"]],
  flight: [
    ["originLat", "originLng"],
    ["destinationLat", "destinationLng"],
  ],
  transport: [
    ["originLat", "originLng"],
    ["destinationLat", "destinationLng"],
  ],
};

export type CoordUpdate = { entity: keyof typeof COORD_COLUMNS; id: string; latName: string; lngName: string; lat: number; lng: number };

/** Guarda coordenadas obtenidas en el mapa (geocodificación revisada por el usuario). */
export async function updateCoordinates(tripId: string, updates: CoordUpdate[]) {
  for (const u of updates) {
    const allowed = COORD_COLUMNS[u.entity]?.some(([la, ln]) => la === u.latName && ln === u.lngName);
    if (!allowed || Math.abs(u.lat) > 90 || Math.abs(u.lng) > 180) continue;
    await updateRows(u.entity as TableKey, { id: u.id, tripId }, { [u.latName]: u.lat, [u.lngName]: u.lng });
  }
  notifyDataChanged();
}

// ---------------------------------------------------------------------------
// Gastos
// ---------------------------------------------------------------------------

function str(fd: FormData, name: string): string {
  const v = fd.get(name);
  return typeof v === "string" ? v.trim() : "";
}

export async function saveExpense(tripId: string, id: string | null, _prev: FormState, fd: FormData): Promise<FormState> {
  try {
    const trip = await getTrip(tripId);
    const base = trip.baseCurrency;
    const errors: Record<string, string> = {};

    const description = str(fd, "description");
    if (!description) errors.description = "Campo obligatorio";
    const category = str(fd, "category") || "otros";
    if (!(category in EXPENSE_CATEGORY)) errors.category = "Categoría no válida";
    const status = str(fd, "status") || "previsto";
    if (!(status in EXPENSE_STATUS)) errors.status = "Estado no válido";
    const currency = (str(fd, "currency") || base).toUpperCase();
    const amountMinor = parseAmount(str(fd, "amount"), currency);
    if (amountMinor === null || amountMinor <= 0) errors.amount = "Importe no válido";
    const date = str(fd, "date") || null;
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) errors.date = "Fecha no válida";

    let rate = 1;
    if (currency !== base) {
      rate = Number(str(fd, "exchangeRate").replace(",", "."));
      if (!Number.isFinite(rate) || rate <= 0) errors.exchangeRate = `Indica cuántos ${base} vale 1 ${currency}`;
    }

    let paidMinor: number | null = null;
    if (status === "parcial") {
      paidMinor = parseAmount(str(fd, "paidAmount"), currency);
      if (paidMinor === null || paidMinor <= 0 || (amountMinor !== null && paidMinor >= amountMinor)) {
        errors.paidAmount = "Debe ser mayor que 0 y menor que el total";
      }
    }

    const travelers = await selectAll<Traveler>("traveler", { tripId });
    const travelerIds = new Set(travelers.map((t) => t.id));
    const paidBy = str(fd, "paidByTravelerId") || null;
    if (paidBy && !travelerIds.has(paidBy)) errors.paidByTravelerId = "Viajero no válido";
    const participants = fd.getAll("participants").map(String).filter((p) => travelerIds.has(p));
    const splitMode = str(fd, "splitMode") === "personalizado" ? "personalizado" : "igual";

    if (Object.keys(errors).length || amountMinor === null) {
      return { ok: false, error: "Revisa los campos marcados", fieldErrors: errors };
    }

    const amountBaseMinor = convertMinor(amountMinor, currency, base, rate);
    let shares: ExpenseShare[] = [];
    if (participants.length > 0) {
      if (splitMode === "igual") {
        const parts = splitEvenly(amountBaseMinor, participants.length);
        shares = participants.map((travelerId, i) => ({ travelerId, shareBaseMinor: parts[i] }));
      } else {
        shares = participants.map((travelerId) => ({
          travelerId,
          shareBaseMinor: convertMinor(parseAmount(str(fd, `share_${travelerId}`), currency) ?? 0, currency, base, rate),
        }));
        const sum = shares.reduce((acc, x) => acc + x.shareBaseMinor, 0);
        if (Math.abs(sum - amountBaseMinor) > participants.length) {
          return {
            ok: false,
            error: "El reparto personalizado debe sumar el importe total",
            fieldErrors: { split: "La suma de las partes no coincide con el total" },
          };
        }
        shares[0].shareBaseMinor += amountBaseMinor - sum;
      }
    }

    const sourceType = str(fd, "sourceType");
    const values = {
      description,
      category,
      date,
      amountMinor,
      currency,
      exchangeRate: rate,
      amountBaseMinor,
      status,
      paidMinor,
      paidByTravelerId: status === "previsto" ? null : paidBy,
      paymentMethod: str(fd, "paymentMethod") || null,
      splitMode,
      destinationId: str(fd, "destinationId") || null,
      sourceType: ["flight", "lodging", "transport", "activity"].includes(sourceType) ? sourceType : null,
      sourceId: sourceType ? str(fd, "sourceId") || null : null,
      shares,
      notes: str(fd, "notes") || null,
    };
    if (id) await updateRows("expense", { id, tripId }, values);
    else await insertRow("expense", { ...values, tripId });
    notifyDataChanged();
    return { ok: true };
  } catch (e) {
    return errorState(e, "No se pudo guardar el gasto.");
  }
}

export async function deleteExpense(tripId: string, id: string) {
  await deleteRows("expense", { id, tripId });
  notifyDataChanged();
}

/** Marca un gasto como pagado. No altera el tipo de cambio congelado. */
export async function setExpenseStatus(tripId: string, id: string, status: "pagado" | "pendiente", paidBy: string | null) {
  await updateRows("expense", { id, tripId }, { status, paidMinor: null, ...(paidBy ? { paidByTravelerId: paidBy } : {}) });
  notifyDataChanged();
}

// ---------------------------------------------------------------------------
// Documentos
// ---------------------------------------------------------------------------

export async function deleteDocument(tripId: string, id: string) {
  const doc = await selectOne<DocumentRow>("document", { id, tripId });
  if (!doc) return;
  await deleteRows("document", { id, tripId });
  await deleteFile(doc.storageKey).catch((e) => console.warn("No se pudo borrar el archivo", e));
  notifyDataChanged();
}
