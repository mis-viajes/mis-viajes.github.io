import type { BaggageAllowance, ChecklistItem } from "../types";
import type { FlightWithBaggage, TripBundle } from "./types";

export type BagCategory = BaggageAllowance["category"];

/** Tipos de equipaje que se comparan contra los vuelos. */
export const CHECKED_BAGS = ["personal", "cabina", "facturado"] as const;

export type BaggageLimit = {
  cat: (typeof CHECKED_BAGS)[number];
  included: number;
  minWeight: number | null;
  minQty: number | null;
  dimensions: (string | null)[];
  notIncluded: FlightWithBaggage[];
  unknown: FlightWithBaggage[];
};

/** Para cada tipo de equipaje, la condición más restrictiva entre los vuelos que la informan. */
export function baggageLimits(flights: FlightWithBaggage[]): BaggageLimit[] {
  return CHECKED_BAGS.map((cat) => {
    const of = (f: FlightWithBaggage) => f.baggage.filter((b) => b.category === cat);
    // Incluido: hay franquicia con cantidad > 0 (o sin cantidad indicada). No incluido: cantidad 0 explícita.
    const included = flights.filter((f) => of(f).some((b) => b.quantity === null || b.quantity > 0));
    const notIncluded = flights.filter((f) => of(f).length > 0 && of(f).every((b) => b.quantity === 0));
    const unknown = flights.filter((f) => of(f).length === 0);
    const allowances = included.flatMap(of);
    const weights = allowances.map((a) => a.maxWeightKg).filter((w): w is number => w !== null);
    const quantities = allowances.map((a) => a.quantity).filter((q): q is number => q !== null);
    return {
      cat,
      included: included.length,
      minWeight: weights.length ? Math.min(...weights) : null,
      minQty: quantities.length ? Math.min(...quantities) : null,
      dimensions: [...new Set(allowances.map((a) => a.maxDimensions).filter(Boolean))],
      notIncluded,
      unknown,
    };
  });
}

export type PackingCheck = {
  bag: (typeof CHECKED_BAGS)[number];
  items: number;
  weightKg: number;
  /** Objetos de este equipaje sin peso: el total puede ser mayor. */
  withoutWeight: number;
  limitKg: number | null;
  problem: string | null;
};

const BAG_NAME: Record<(typeof CHECKED_BAGS)[number], string> = { personal: "El artículo personal", cabina: "El equipaje de cabina", facturado: "El equipaje facturado" };

/** Compara lo que va en cada equipaje con el límite más restrictivo de todos los vuelos activos. */
export function packingCheck(items: ChecklistItem[], allFlights: FlightWithBaggage[]): PackingCheck[] {
  const flights = allFlights.filter((f) => f.bookingStatus !== "cancelado");
  const limits = baggageLimits(flights);
  return limits.flatMap((limit) => {
    const inBag = items.filter((i) => i.list === "maleta" && i.bag === limit.cat);
    if (inBag.length === 0) return [];
    const weightKg = Math.round(inBag.reduce((sum, i) => sum + (i.weightKg ?? 0) * (i.quantity ?? 1), 0) * 100) / 100;
    const withoutWeight = inBag.filter((i) => i.weightKg === null).length;
    const limitKg = limit.minWeight === null ? null : limit.minWeight * Math.max(limit.minQty ?? 1, 1);
    let problem: string | null = null;
    if (limit.notIncluded.length > 0) {
      problem = `${BAG_NAME[limit.cat]} no está incluido en ${limit.notIncluded.length} ${limit.notIncluded.length === 1 ? "vuelo" : "vuelos"}`;
    } else if (limitKg !== null && weightKg > limitKg) {
      problem = `${BAG_NAME[limit.cat]} pesa ${weightKg} kg y el límite es ${limitKg} kg`;
    }
    return [{ bag: limit.cat, items: inBag.length, weightKg, withoutWeight, limitKg, problem }];
  });
}

export type Suggestion = Pick<ChecklistItem, "list" | "title" | "groupName"> & Partial<Pick<ChecklistItem, "bag" | "priority">>;

const task = (title: string, groupName: string, priority: ChecklistItem["priority"] = "media"): Suggestion => ({ list: "tareas", title, groupName, priority });
const pack = (title: string, groupName: string, bag: BagCategory): Suggestion => ({ list: "maleta", title, groupName, bag });

const TASK_TEMPLATE: Suggestion[] = [
  task("Revisar la vigencia de los pasaportes", "Documentos", "alta"),
  task("Comprobar requisitos de entrada de cada país", "Documentos", "alta"),
  task("Contratar seguro de viaje", "Documentos"),
  task("Avisar al banco de las fechas del viaje", "Dinero"),
  task("Preparar medios de pago para el extranjero", "Dinero"),
  task("Hacer el check-in en línea de cada vuelo", "Vuelos"),
  task("Guardar los documentos sin conexión en esta app", "Antes de salir"),
  task("Descargar mapas sin conexión", "Antes de salir"),
  task("Contratar roaming o eSIM", "Antes de salir"),
];

const PACKING_TEMPLATE: Suggestion[] = [
  pack("Pasaporte", "Documentos", "personal"),
  pack("Medios de pago", "Documentos", "personal"),
  pack("Teléfono y cargador", "Electrónica", "personal"),
  pack("Adaptador de enchufe", "Electrónica", "cabina"),
  pack("Medicamentos habituales", "Salud", "cabina"),
  pack("Ropa interior", "Ropa", "facturado"),
  pack("Calcetines", "Ropa", "facturado"),
  pack("Poleras", "Ropa", "facturado"),
  pack("Pantalones", "Ropa", "facturado"),
  pack("Abrigo o chaqueta", "Ropa", "cabina"),
  pack("Calzado cómodo", "Ropa", "facturado"),
  pack("Artículos de aseo", "Aseo", "facturado"),
];

const UNBOOKED = new Set(["idea", "estimado"]);
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** Lo que falta reservar según los datos del propio viaje. No inventa fechas ni horarios. */
function bookingTasks(b: TripBundle): Suggestion[] {
  const route = (a: string | null, c: string | null) => `${a ?? "?"} → ${c ?? "?"}`;
  return [
    ...b.flights.filter((f) => UNBOOKED.has(f.bookingStatus)).map((f) => task(`Reservar vuelo ${route(f.originCode ?? f.originName, f.destinationCode ?? f.destinationName)}`, "Reservas", "alta")),
    ...b.transports.filter((t) => UNBOOKED.has(t.bookingStatus)).map((t) => task(`Comprar billete ${route(t.origin, t.destination)}`, "Reservas", "alta")),
    ...b.lodgings.filter((l) => UNBOOKED.has(l.bookingStatus)).map((l) => task(`Reservar alojamiento: ${l.name}`, "Reservas", "alta")),
    ...b.activities.filter((a) => a.requiresBooking && UNBOOKED.has(a.bookingStatus)).map((a) => task(`Reservar: ${a.name}`, "Reservas")),
    ...b.restaurants.filter((r) => r.requiresBooking && !r.reservedAt).map((r) => task(`Reservar mesa: ${r.name}`, "Reservas", "baja")),
  ];
}

/** Sugerencias de una lista que todavía no existen en el viaje. */
export function suggestItems(b: TripBundle, list: ChecklistItem["list"]): Suggestion[] {
  const existing = new Set(b.checklist.filter((c) => c.list === list).map((c) => norm(c.title)));
  const all = list === "tareas" ? [...bookingTasks(b), ...TASK_TEMPLATE] : PACKING_TEMPLATE;
  return all.filter((s) => !existing.has(norm(s.title)));
}

const PRIORITY_ORDER = { alta: 0, media: 1, baja: 2 };

/** Pendientes primero; entre ellos, por fecha límite y prioridad. */
export function sortChecklist(items: ChecklistItem[]): ChecklistItem[] {
  return [...items].sort(
    (x, y) =>
      Number(x.status === "hecho") - Number(y.status === "hecho") ||
      (x.dueDate ?? "9999").localeCompare(y.dueDate ?? "9999") ||
      PRIORITY_ORDER[x.priority] - PRIORITY_ORDER[y.priority] ||
      x.title.localeCompare(y.title, "es"),
  );
}
