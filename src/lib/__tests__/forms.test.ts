import { describe, expect, it } from "vitest";
import { ENTITIES } from "../entities";
import { parseEntityForm } from "../forms";

const fd = (entries: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
};

describe("parseEntityForm", () => {
  it("convierte importes, fechas y coordenadas", () => {
    const r = parseEntityForm(
      ENTITIES.lodging,
      fd({ name: "Hotel", checkInDate: "2026-12-11", checkOutDate: "2026-12-14", priceMinor: "420,50", currency: "EUR", lat: "40.41", lng: "-3.70", bookingStatus: "reservado" }),
    );
    expect(r.ok).toBe(true);
    expect(r.values).toMatchObject({ name: "Hotel", priceMinor: 42050, lat: 40.41, lng: -3.7, bookingStatus: "reservado", city: null });
  });

  it("valida obligatorios, orden de fechas y zona horaria", () => {
    const r = parseEntityForm(ENTITIES.trip, fd({ name: "", startDate: "2026-12-10", endDate: "2026-12-01", baseCurrency: "CLP" }));
    expect(r.ok).toBe(false);
    expect(r.errors.name).toBeDefined();
    expect(r.errors.endDate).toBeDefined();
    const f = parseEntityForm(ENTITIES.flight, fd({ departureTz: "Marte/Olympus", bookingStatus: "idea", direction: "ida", currency: "EUR" }));
    expect(f.errors.departureTz).toBeDefined();
  });

  it("rechaza opciones fuera de la lista y enlaces no http", () => {
    const r = parseEntityForm(ENTITIES.activity, fd({ name: "X", category: "inventada", bookingStatus: "idea", bookingUrl: "javascript:alert(1)", currency: "EUR" }));
    expect(r.errors.category).toBeDefined();
    expect(r.errors.bookingUrl).toBeDefined();
  });
});
