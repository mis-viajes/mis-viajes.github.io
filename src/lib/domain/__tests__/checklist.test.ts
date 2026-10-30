import { describe, expect, it } from "vitest";
import type { Activity, BaggageAllowance, ChecklistItem, Flight, Transport, Trip } from "../../types";
import { computeAlerts } from "../alerts";
import { baggageLimits, packingCheck, sortChecklist, suggestItems } from "../checklist";
import { monthWeeks, shiftDate, shiftMonth, weekDays } from "../dates";
import { compareActivities } from "../itinerary";
import { searchBundles } from "../search";
import type { FlightWithBaggage, TripBundle } from "../types";

const trip: Trip = {
  id: "t", name: "Viaje de prueba", description: null, startDate: "2027-03-01", endDate: "2027-03-05", baseCurrency: "CLP",
  budgetMinor: null, coverImage: null, status: "planificando", notes: null, createdAt: "", updatedAt: "",
};

const bundle = (over: Partial<TripBundle>): TripBundle => ({
  trip, travelers: [], destinations: [], flights: [], lodgings: [], transports: [], activities: [], restaurants: [], expenses: [], documents: [], checklist: [], checklistAvailable: true, ...over,
});

const item = (over: Partial<ChecklistItem>): ChecklistItem => ({
  id: Math.random().toString(), tripId: "t", list: "maleta", title: "Objeto", groupName: null, status: "pendiente", priority: "media",
  dueDate: null, bag: null, quantity: null, weightKg: null, notes: null, createdAt: "", updatedAt: "", ...over,
});

const allowance = (over: Partial<BaggageAllowance>): BaggageAllowance => ({
  id: "b", tripId: "t", flightId: "f", category: "facturado", quantity: 1, maxWeightKg: 23, maxDimensions: null, extraCostMinor: null,
  currency: null, restrictions: null, createdAt: "", updatedAt: "", ...over,
});

const flight = (baggage: BaggageAllowance[], over: Partial<Flight> = {}): FlightWithBaggage => ({ id: Math.random().toString(), bookingStatus: "confirmado", baggage, ...over }) as FlightWithBaggage;

describe("equipaje", () => {
  it("usa el límite más restrictivo entre vuelos", () => {
    const limits = baggageLimits([flight([allowance({ maxWeightKg: 23 })]), flight([allowance({ maxWeightKg: 20 })])]);
    expect(limits.find((l) => l.cat === "facturado")?.minWeight).toBe(20);
  });

  it("avisa si la maleta supera el límite", () => {
    const [check] = packingCheck([item({ bag: "facturado", weightKg: 5, quantity: 5 })], [flight([allowance({ maxWeightKg: 20 })])]);
    expect(check.weightKg).toBe(25);
    expect(check.problem).toContain("20 kg");
  });

  it("no da error si todo cabe, pero cuenta lo que no tiene peso", () => {
    const [check] = packingCheck([item({ bag: "facturado", weightKg: 5 }), item({ bag: "facturado" })], [flight([allowance({})])]);
    expect(check.problem).toBeNull();
    expect(check.withoutWeight).toBe(1);
  });

  it("multiplica el límite por las piezas permitidas e ignora vuelos cancelados", () => {
    const flights = [flight([allowance({ quantity: 2 })]), flight([allowance({ maxWeightKg: 5 })], { bookingStatus: "cancelado" })];
    expect(packingCheck([item({ bag: "facturado", weightKg: 40 })], flights)[0].limitKg).toBe(46);
  });

  it("detecta equipaje no incluido en algún vuelo", () => {
    const flights = [flight([allowance({})]), flight([allowance({ quantity: 0 })])];
    expect(packingCheck([item({ bag: "facturado", weightKg: 1 })], flights)[0].problem).toContain("no está incluido");
  });
});

describe("sugerencias", () => {
  it("incluye lo que falta reservar sin inventar datos y omite lo ya añadido", () => {
    const transport = { id: "x", origin: "Madrid", destination: "París", bookingStatus: "idea", type: "tren" } as Transport;
    const b = bundle({ transports: [transport], checklist: [item({ list: "tareas", title: "Contratar SEGURO de viaje" })] });
    const titles = suggestItems(b, "tareas").map((s) => s.title);
    expect(titles).toContain("Comprar billete Madrid → París");
    expect(titles).not.toContain("Contratar seguro de viaje");
  });

  it("no sugiere reservar lo ya confirmado", () => {
    const transport = { id: "x", origin: "A", destination: "B", bookingStatus: "confirmado", type: "tren" } as Transport;
    expect(suggestItems(bundle({ transports: [transport] }), "tareas").map((s) => s.title)).not.toContain("Comprar billete A → B");
  });
});

it("ordena pendientes primero, por fecha y prioridad", () => {
  const sorted = sortChecklist([
    item({ title: "hecha", status: "hecho", dueDate: "2027-01-01" }),
    item({ title: "sin fecha" }),
    item({ title: "tarde", dueDate: "2027-02-02" }),
    item({ title: "pronto", dueDate: "2027-02-01" }),
  ]);
  expect(sorted.map((i) => i.title)).toEqual(["pronto", "tarde", "sin fecha", "hecha"]);
});

describe("alertas de la checklist", () => {
  const now = new Date("2027-02-20T12:00:00Z");
  it("avisa de tareas vencidas y próximas, no de las hechas", () => {
    const b = bundle({
      checklist: [
        item({ list: "tareas", dueDate: "2027-02-10" }),
        item({ list: "tareas", dueDate: "2027-02-21" }),
        item({ list: "tareas", dueDate: "2027-02-10", status: "hecho" }),
      ],
    });
    const alerts = computeAlerts(b, now, "2027-02-20");
    expect(alerts.find((a) => a.id === "tasks-overdue")?.title).toBe("1 tarea vencida");
    expect(alerts.find((a) => a.id === "tasks-soon")).toBeDefined();
  });
});

describe("calendario", () => {
  it("las semanas empiezan en lunes y cubren el mes", () => {
    const weeks = monthWeeks("2027-03-15");
    expect(weeks[0][0]).toBe("2027-03-01");
    expect(weeks.flat().at(-1)).toBe("2027-04-04");
    expect(weeks.every((w) => w.length === 7)).toBe(true);
  });

  it("calcula semana y desplazamientos cruzando meses", () => {
    expect(weekDays("2027-03-03")[0]).toBe("2027-03-01");
    expect(shiftDate("2027-02-28", 1)).toBe("2027-03-01");
    expect(shiftMonth("2027-01-31", 1)).toBe("2027-02-01");
  });
});

it("las actividades con hora van primero y las demás por orden manual", () => {
  const a = (name: string, startTime: string | null, position: number) => ({ name, startTime, position }) as Activity;
  const sorted = [a("sin hora 2", null, 2), a("tarde", "18:00", 0), a("sin hora 1", null, 1)].sort(compareActivities);
  expect(sorted.map((x) => x.name)).toEqual(["tarde", "sin hora 1", "sin hora 2"]);
});

describe("búsqueda", () => {
  const b = bundle({
    transports: [{ id: "x", origin: "Córdoba", destination: "Sevilla", type: "tren", operator: "Renfe", bookingCode: "SECRETO" } as Transport],
    checklist: [item({ title: "Adaptador", list: "maleta" })],
  });

  it("ignora acentos y mayúsculas y exige todas las palabras", () => {
    expect(searchBundles([b], "cordoba renfe")[0].href).toBe("/trips/t/transport");
    expect(searchBundles([b], "cordoba iberia")).toHaveLength(0);
  });

  it("enlaza la checklist a su lista y no busca códigos de reserva", () => {
    expect(searchBundles([b], "adaptador")[0].href).toBe("/trips/t/checklist?lista=maleta");
    expect(searchBundles([b], "SECRETO")).toHaveLength(0);
  });

  it("sin texto no devuelve nada", () => {
    expect(searchBundles([b], "   ")).toHaveLength(0);
  });
});
