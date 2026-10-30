import { describe, expect, it } from "vitest";
import type { Activity, Flight, Lodging, Trip } from "../../types";
import { computeAlerts, overlappingActivities } from "../alerts";
import { localToInstant, minutesBetween, nightsBetween, tripDays, tripPhase } from "../dates";
import { estimateMinutes, haversineKm } from "../geo";
import { buildItinerary, isInDestination, suggestDestination } from "../itinerary";
import { findConnections, flightSegment } from "../segments";
import type { TripBundle } from "../types";

const trip: Trip = {
  id: "t", name: "Test", description: null, startDate: "2026-12-10", endDate: "2026-12-13", baseCurrency: "CLP",
  budgetMinor: null, coverImage: null, status: "planificando", notes: null, createdAt: "", updatedAt: "",
};

function flight(over: Partial<Flight>): Flight & { baggage: [] } {
  return {
    id: Math.random().toString(), tripId: "t", direction: "ida", airline: "X", flightNumber: "1", bookingCode: null,
    originCode: "SCL", originName: null, originLat: null, originLng: null, destinationCode: "MAD", destinationName: null,
    destinationLat: null, destinationLng: null, departureLocal: null, departureTz: null, arrivalLocal: null, arrivalTz: null,
    terminalOrigin: null, terminalDestination: null, seats: null, cabinClass: null, priceMinor: null, currency: null,
    bookingStatus: "confirmado", notes: null, createdAt: "", updatedAt: "", baggage: [], ...over,
  };
}

function lodging(over: Partial<Lodging>): Lodging {
  return {
    id: Math.random().toString(), tripId: "t", destinationId: null, name: "Hotel", type: "hotel", platform: null, address: null,
    city: null, country: null, checkInDate: null, checkOutDate: null, checkInTime: null, checkOutTime: null, priceMinor: null,
    taxesMinor: null, currency: null, bookingCode: null, holderName: null, guests: null, cancellationPolicy: null, amenities: null,
    accessInfo: null, hostContact: null, bookingUrl: null, bookingStatus: "confirmado", lat: null, lng: null, notes: null,
    createdAt: "", updatedAt: "", ...over,
  };
}

function activity(over: Partial<Activity>): Activity {
  return {
    id: Math.random().toString(), tripId: "t", destinationId: null, name: "A", description: null, category: "turismo", city: null,
    address: null, date: null, startTime: null, endTime: null, priceMinor: null, currency: null, requiresBooking: false,
    bookingStatus: "idea", bookingUrl: null, bookingCode: null, lat: null, lng: null, notes: null, createdAt: "", updatedAt: "", ...over,
  };
}

const bundle = (over: Partial<TripBundle>): TripBundle => ({
  trip, travelers: [], destinations: [], flights: [], lodgings: [], transports: [], activities: [], restaurants: [], expenses: [], documents: [], ...over,
});

describe("fechas", () => {
  it("duración del viaje y noches", () => {
    expect(tripDays("2026-12-10", "2026-12-13")).toBe(4);
    expect(nightsBetween("2026-12-11", "2026-12-14")).toBe(3);
    expect(nightsBetween("2026-12-14", "2026-12-11")).toBeNull();
  });
  it("fase del viaje según la fecha", () => {
    expect(tripPhase(trip, "2026-12-01")).toBe("futuro");
    expect(tripPhase(trip, "2026-12-11")).toBe("en_curso");
    expect(tripPhase(trip, "2026-12-20")).toBe("finalizado");
    expect(tripPhase({ ...trip, status: "cancelado" }, "2026-12-11")).toBe("cancelado");
  });
  it("duración real de un vuelo entre zonas horarias", () => {
    const dep = localToInstant("2026-12-10T12:30", "America/Santiago")!;
    const arr = localToInstant("2026-12-11T06:45", "Europe/Madrid")!;
    // Santiago está en UTC-3 en diciembre y Madrid en UTC+1: 14 h 15 min de vuelo.
    expect(minutesBetween(dep.date, arr.date)).toBe(14 * 60 + 15);
  });
});

describe("conexiones", () => {
  it("detecta conexiones ajustadas y solapadas", () => {
    const a = flight({ departureLocal: "2026-12-10T08:00", departureTz: "Europe/Madrid", arrivalLocal: "2026-12-10T10:00", arrivalTz: "Europe/Madrid" });
    const b = flight({ departureLocal: "2026-12-10T10:40", departureTz: "Europe/Madrid", arrivalLocal: "2026-12-10T12:00", arrivalTz: "Europe/Madrid" });
    const c = flight({ departureLocal: "2026-12-10T11:30", departureTz: "Europe/Madrid", arrivalLocal: "2026-12-10T13:00", arrivalTz: "Europe/Madrid" });
    const conns = findConnections([a, b, c].map(flightSegment));
    expect(conns[0]).toMatchObject({ gapMinutes: 40, tight: true, overlap: false });
    expect(conns[1]).toMatchObject({ gapMinutes: -30, overlap: true });
  });
});

describe("alertas", () => {
  it("avisa de vuelos sin equipaje y noches sin alojamiento, pero no de noches en vuelo", () => {
    const b = bundle({
      flights: [flight({ departureLocal: "2026-12-10T22:00", departureTz: "America/Santiago", arrivalLocal: "2026-12-11T14:00", arrivalTz: "Europe/Madrid" })],
      lodgings: [lodging({ checkInDate: "2026-12-11", checkOutDate: "2026-12-12" })],
    });
    const alerts = computeAlerts(b, new Date("2026-11-01T00:00:00Z"), "2026-11-01");
    expect(alerts.some((a) => a.id.startsWith("flight-nobag"))).toBe(true);
    const gaps = alerts.find((a) => a.id === "lodging-gaps");
    // Noches: 10 (en vuelo), 11 (hotel), 12 (sin alojamiento).
    expect(gaps?.title).toBe("1 noche sin alojamiento registrado");
  });

  it("detecta actividades superpuestas", () => {
    const pairs = overlappingActivities({
      activities: [
        activity({ date: "2026-12-11", startTime: "10:00", endTime: "13:00" }),
        activity({ date: "2026-12-11", startTime: "12:30", endTime: "14:00" }),
        activity({ date: "2026-12-11", startTime: "14:00", endTime: "15:00" }),
      ],
    });
    expect(pairs).toHaveLength(1);
  });

  it("no da por pagado ni confirmado nada que no lo esté", () => {
    const b = bundle({ activities: [activity({ name: "Museo", requiresBooking: true, bookingStatus: "idea" })] });
    const alerts = computeAlerts(b, new Date("2026-11-01T00:00:00Z"), "2026-11-01");
    expect(alerts.some((a) => a.title === "Reserva pendiente: Museo")).toBe(true);
  });
});

describe("itinerario", () => {
  it("indica dónde se duerme cada noche", () => {
    const l = lodging({ name: "Hotel Centro", checkInDate: "2026-12-10", checkOutDate: "2026-12-12" });
    const days = buildItinerary(bundle({ lodgings: [l] }));
    expect(days.map((d) => d.lodging?.name ?? null)).toEqual(["Hotel Centro", "Hotel Centro", null, null]);
    expect(days[2].checkOuts).toHaveLength(1);
  });

  it("un destino con una sola fecha conocida solo cuenta ese día", () => {
    const d = (arrivalDate: string | null, departureDate: string | null) => ({ arrivalDate, departureDate });
    expect(isInDestination(d("2026-12-03", "2026-12-07"), "2026-12-05")).toBe(true);
    expect(isInDestination(d(null, "2026-11-18"), "2026-11-13")).toBe(false);
    expect(isInDestination(d(null, "2026-11-18"), "2026-11-18")).toBe(true);
    expect(isInDestination(d("2026-11-14", null), "2026-11-20")).toBe(false);
    expect(isInDestination(d(null, null), "2026-11-20")).toBe(false);
  });

  it("sugiere destino por ciudad, sin acentos ni mayúsculas", () => {
    const d = { id: "p", tripId: "t", city: "París", country: null, position: 0, arrivalDate: null, departureDate: null, timezone: null, lat: null, lng: null, notes: null, createdAt: "", updatedAt: "" };
    expect(suggestDestination([d], "paris", null)?.id).toBe("p");
    expect(suggestDestination([d], "Roma", null)).toBeNull();
  });
});

describe("geo", () => {
  it("distancia Madrid–París aproximada", () => {
    const km = haversineKm({ lat: 40.4168, lng: -3.7038 }, { lat: 48.8566, lng: 2.3522 });
    expect(km).toBeGreaterThan(1040);
    expect(km).toBeLessThan(1060);
  });
  it("estimación a pie de 1 km", () => {
    expect(estimateMinutes(1, "walking")).toBe(16);
  });
});
