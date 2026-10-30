import { isMissingSchema, selectAll, selectOne } from "./db";
import type { TripBundle } from "./domain/types";
import type {
  Activity,
  BaggageAllowance,
  ChecklistItem,
  Destination,
  DocumentRow,
  ExchangeRate,
  Expense,
  Flight,
  Lodging,
  Repayment,
  Restaurant,
  Transport,
  Traveler,
  Trip,
} from "./types";

const BAG_ORDER = { personal: 0, cabina: 1, facturado: 2, adicional: 3 } as const;

type Rows = {
  travelers: Traveler[];
  destinations: Destination[];
  flights: Flight[];
  baggage: BaggageAllowance[];
  lodgings: Lodging[];
  transports: Transport[];
  activities: Activity[];
  restaurants: Restaurant[];
  expenses: Expense[];
  documents: DocumentRow[];
  /** null: la tabla aún no existe en Supabase. */
  checklist: ChecklistItem[] | null;
  repayments: Repayment[] | null;
};

/** Tablas añadidas después de la primera versión: si aún no existen, devuelve null. */
const optional = <T>(query: Promise<T[]>) =>
  query.catch((e) => {
    if (isMissingSchema(e)) return null;
    throw e;
  });

async function loadRows(filter: Record<string, string>): Promise<Rows> {
  const [travelers, destinations, flights, baggage, lodgings, transports, activities, restaurants, expenses, documents, checklist, repayments] = await Promise.all([
    selectAll<Traveler>("traveler", filter, [["createdAt", true]]),
    selectAll<Destination>("destination", filter, [["position", true], ["arrivalDate", true]]),
    selectAll<Flight>("flight", filter, [["departureLocal", true]]),
    selectAll<BaggageAllowance>("baggage", filter),
    selectAll<Lodging>("lodging", filter, [["checkInDate", true]]),
    selectAll<Transport>("transport", filter, [["departureLocal", true]]),
    selectAll<Activity>("activity", filter, [["date", true], ["startTime", true]]),
    selectAll<Restaurant>("restaurant", filter, [["name", true]]),
    selectAll<Expense>("expense", filter, [["date", false], ["createdAt", false]]),
    selectAll<DocumentRow>("document", filter, [["createdAt", false]]),
    optional(selectAll<ChecklistItem>("checklist", filter, [["createdAt", true]])),
    optional(selectAll<Repayment>("repayment", filter, [["date", true]])),
  ]);
  return { travelers, destinations, flights, baggage, lodgings, transports, activities, restaurants, expenses, documents, checklist, repayments };
}

function assemble(trip: Trip, r: Rows): TripBundle {
  const mine = <T extends { tripId: string }>(list: T[]) => list.filter((x) => x.tripId === trip.id);
  return {
    trip,
    travelers: mine(r.travelers),
    destinations: mine(r.destinations),
    flights: mine(r.flights).map((f) => ({
      ...f,
      baggage: r.baggage.filter((b) => b.flightId === f.id).sort((a, b) => BAG_ORDER[a.category] - BAG_ORDER[b.category]),
    })),
    lodgings: mine(r.lodgings),
    transports: mine(r.transports),
    activities: mine(r.activities),
    restaurants: mine(r.restaurants),
    expenses: mine(r.expenses).map((e) => ({ ...e, shares: Array.isArray(e.shares) ? e.shares : [] })),
    documents: mine(r.documents),
    checklist: mine(r.checklist ?? []),
    checklistAvailable: r.checklist !== null,
    repayments: mine(r.repayments ?? []),
    repaymentsAvailable: r.repayments !== null,
  };
}

/** Toda la información de un viaje. */
export async function fetchTripBundle(tripId: string): Promise<TripBundle | null> {
  const trip = await selectOne<Trip>("trip", { id: tripId });
  if (!trip) return null;
  return assemble(trip, await loadRows({ tripId }));
}

/** Todos los viajes del usuario (para el dashboard), sin mezclar datos entre ellos. */
export async function fetchAllBundles(): Promise<TripBundle[]> {
  const [trips, rows] = await Promise.all([selectAll<Trip>("trip", {}, [["startDate", true]]), loadRows({})]);
  return trips.map((t) => assemble(t, rows));
}

export async function fetchTrips(): Promise<Trip[]> {
  return selectAll<Trip>("trip", {}, [["startDate", true]]);
}

export async function fetchExchangeRates(): Promise<ExchangeRate[]> {
  return selectAll<ExchangeRate>("exchangeRate", {}, [["date", false], ["createdAt", false]]);
}

/** Último tipo de cambio registrado para cada par, p. ej. "EUR>CLP". */
export function latestRates(rates: ExchangeRate[]): Record<string, { rate: number; date: string }> {
  const out: Record<string, { rate: number; date: string }> = {};
  for (const r of rates) out[`${r.fromCurrency}>${r.toCurrency}`] ??= { rate: r.rate, date: r.date };
  return out;
}
