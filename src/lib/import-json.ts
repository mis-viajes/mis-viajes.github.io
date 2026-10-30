import { insertRow, insertRows } from "./db";
import { notifyDataChanged } from "./hooks";
import { uploadDocument } from "./storage";
import type { DocumentRow, Expense } from "./types";

/**
 * Importa viajes desde un archivo JSON: el mismo formato que «Exportar mis datos»
 * ({ version, trips: TripBundle[], exchangeRates }). Los ids del archivo solo sirven para
 * relacionar registros entre sí: se crean registros nuevos y se reasignan las referencias.
 * Los documentos se suben si traen el archivo en `fileBase64`; si no, se omiten.
 */

type Json = Record<string, unknown>;

const COLUMNS = {
  trip: ["name", "description", "startDate", "endDate", "baseCurrency", "budgetMinor", "coverImage", "status", "notes"],
  traveler: ["name", "color"],
  destination: ["city", "country", "position", "arrivalDate", "departureDate", "timezone", "lat", "lng", "notes"],
  flight: [
    "direction", "airline", "flightNumber", "bookingCode", "originCode", "originName", "originLat", "originLng",
    "destinationCode", "destinationName", "destinationLat", "destinationLng", "departureLocal", "departureTz",
    "arrivalLocal", "arrivalTz", "terminalOrigin", "terminalDestination", "seats", "cabinClass", "priceMinor",
    "currency", "bookingStatus", "notes",
  ],
  baggage: ["category", "quantity", "maxWeightKg", "maxDimensions", "extraCostMinor", "currency", "restrictions"],
  lodging: [
    "name", "type", "platform", "address", "city", "country", "checkInDate", "checkOutDate", "checkInTime",
    "checkOutTime", "priceMinor", "taxesMinor", "currency", "bookingCode", "holderName", "guests",
    "cancellationPolicy", "amenities", "accessInfo", "hostContact", "bookingUrl", "bookingStatus", "lat", "lng", "notes",
  ],
  transport: [
    "type", "operator", "serviceNumber", "origin", "originLat", "originLng", "destination", "destinationLat",
    "destinationLng", "departureLocal", "arrivalLocal", "timezone", "seat", "travelClass", "bookingCode",
    "baggageInfo", "directionsInfo", "priceMinor", "currency", "bookingStatus", "notes",
  ],
  activity: [
    "name", "description", "category", "city", "address", "date", "startTime", "endTime", "priceMinor", "currency",
    "requiresBooking", "bookingStatus", "bookingUrl", "bookingCode", "lat", "lng", "notes",
  ],
  restaurant: [
    "name", "address", "city", "cuisine", "priceRange", "openingHours", "rating", "mapsUrl", "website",
    "requiresBooking", "reservedAt", "listStatus", "lat", "lng", "notes",
  ],
  expense: [
    "description", "category", "date", "amountMinor", "currency", "exchangeRate", "amountBaseMinor", "status",
    "paidMinor", "paymentMethod", "splitMode", "notes",
  ],
  exchangeRate: ["fromCurrency", "toCurrency", "rate", "date", "source"],
  checklist: ["list", "title", "groupName", "status", "priority", "dueDate", "bag", "quantity", "weightKg", "notes"],
} as const;

function pick(obj: Json, keys: readonly string[]): Json {
  const out: Json = {};
  for (const k of keys) if (obj[k] !== undefined) out[k] = obj[k];
  return out;
}

const list = (v: unknown): Json[] => (Array.isArray(v) ? (v as Json[]) : []);

export type ImportSummary = { trips: number; flights: number; documents: number; expenses: number; skippedDocuments: number };

function base64ToFile(b64: string, name: string, type: string): File {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new File([bytes], name, { type });
}

export function parseBackup(text: string): { trips: Json[]; exchangeRates: Json[] } {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("El archivo no es un JSON válido.");
  }
  const d = data as Json;
  const trips = list(d.trips);
  if (trips.length === 0 || !trips.every((t) => t.trip && typeof (t.trip as Json).name === "string")) {
    throw new Error("El archivo no contiene viajes en el formato de Travel Manager.");
  }
  return { trips, exchangeRates: list(d.exchangeRates) };
}

export async function importBackup(text: string, onProgress?: (msg: string) => void): Promise<ImportSummary> {
  const { trips, exchangeRates } = parseBackup(text);
  const summary: ImportSummary = { trips: 0, flights: 0, documents: 0, expenses: 0, skippedDocuments: 0 };

  if (exchangeRates.length) await insertRows("exchangeRate", exchangeRates.map((r) => pick(r, COLUMNS.exchangeRate)));

  for (const bundle of trips) {
    const tripData = bundle.trip as Json;
    onProgress?.(`Creando «${tripData.name}»…`);
    const trip = await insertRow<{ id: string }>("trip", pick(tripData, COLUMNS.trip));
    const tripId = trip.id;
    summary.trips++;

    // Mapas id del archivo → id nuevo, para reasignar referencias.
    const ids: Record<string, Map<string, string>> = {};
    const remember = (kind: string, oldId: unknown, newId: string) => {
      (ids[kind] ??= new Map()).set(String(oldId), newId);
    };
    const ref = (kind: string, oldId: unknown) => (oldId ? (ids[kind]?.get(String(oldId)) ?? null) : null);

    for (const t of list(bundle.travelers)) {
      remember("traveler", t.id, (await insertRow<{ id: string }>("traveler", { ...pick(t, COLUMNS.traveler), tripId })).id);
    }
    for (const d of list(bundle.destinations)) {
      remember("destination", d.id, (await insertRow<{ id: string }>("destination", { ...pick(d, COLUMNS.destination), tripId })).id);
    }
    for (const f of list(bundle.flights)) {
      const created = await insertRow<{ id: string }>("flight", { ...pick(f, COLUMNS.flight), tripId });
      remember("flight", f.id, created.id);
      await insertRows("baggage", list(f.baggage).map((b) => ({ ...pick(b, COLUMNS.baggage), tripId, flightId: created.id })));
      summary.flights++;
    }
    for (const [kind, table] of [
      ["lodging", "lodging"],
      ["transport", "transport"],
      ["activity", "activity"],
      ["restaurant", "restaurant"],
    ] as const) {
      const key = kind === "activity" ? "activities" : `${kind}s`;
      for (const row of list(bundle[key])) {
        const values: Json = { ...pick(row, COLUMNS[kind]), tripId };
        if ("destinationId" in row) values.destinationId = ref("destination", row.destinationId);
        remember(kind, row.id, (await insertRow<{ id: string }>(table, values)).id);
      }
    }
    for (const e of list(bundle.expenses)) {
      const shares = list(e.shares)
        .map((s) => ({ travelerId: ref("traveler", s.travelerId), shareBaseMinor: Number(s.shareBaseMinor) }))
        .filter((s) => s.travelerId);
      const sourceType = (e.sourceType as Expense["sourceType"]) ?? null;
      const sourceId = sourceType ? ref(sourceType, e.sourceId) : null;
      const created = await insertRow<{ id: string }>("expense", {
        ...pick(e, COLUMNS.expense),
        tripId,
        destinationId: ref("destination", e.destinationId),
        paidByTravelerId: ref("traveler", e.paidByTravelerId),
        sourceType: sourceId ? sourceType : null,
        sourceId,
        shares,
      });
      remember("expense", e.id, created.id);
      summary.expenses++;
    }
    await insertRows(
      "repayment",
      list(bundle.repayments)
        .map((r) => ({ tripId, fromTravelerId: ref("traveler", r.fromTravelerId), toTravelerId: ref("traveler", r.toTravelerId), amountBaseMinor: r.amountBaseMinor, date: r.date, notes: r.notes ?? null }))
        .filter((r) => r.fromTravelerId && r.toTravelerId),
    );
    await insertRows("checklist", list(bundle.checklist).map((c) => ({ ...pick(c, COLUMNS.checklist), tripId })));
    for (const doc of list(bundle.documents)) {
      if (typeof doc.fileBase64 !== "string") {
        summary.skippedDocuments++;
        continue;
      }
      onProgress?.(`Subiendo «${doc.title}»…`);
      const linkedType = (doc.linkedType as DocumentRow["linkedType"]) ?? null;
      const linkedId = linkedType ? ref(linkedType, doc.linkedId) : null;
      await uploadDocument(tripId, base64ToFile(doc.fileBase64, String(doc.fileName), String(doc.mimeType)), {
        title: String(doc.title ?? doc.fileName),
        type: (doc.type as DocumentRow["type"]) ?? "otro",
        linkedType: linkedId ? linkedType : null,
        linkedId,
      });
      summary.documents++;
    }
  }
  notifyDataChanged();
  return summary;
}
