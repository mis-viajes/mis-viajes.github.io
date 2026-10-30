import type { FormContext } from "@/components/record-form";
import type { TripBundle } from "./domain/types";

export function formContext(b: TripBundle): FormContext {
  return {
    baseCurrency: b.trip.baseCurrency,
    destinations: b.destinations.map((d) => ({ id: d.id, label: d.country ? `${d.city} (${d.country})` : d.city })),
  };
}

export function destinationName(b: TripBundle, id: string | null | undefined): string | null {
  if (!id) return null;
  return b.destinations.find((d) => d.id === id)?.city ?? null;
}

export function travelerName(b: TripBundle, id: string | null | undefined): string | null {
  if (!id) return null;
  return b.travelers.find((t) => t.id === id)?.name ?? null;
}

/** Ciudades del viaje en orden de visita (destinos o, en su defecto, alojamientos). */
export function tripCities(b: TripBundle): string[] {
  const cities = b.destinations.length ? b.destinations.map((d) => d.city) : b.lodgings.map((l) => l.city).filter(Boolean);
  return [...new Set(cities as string[])];
}

export function tripCountries(b: TripBundle): string[] {
  const countries = [...b.destinations.map((d) => d.country), ...b.lodgings.map((l) => l.country)].filter(Boolean);
  return [...new Set(countries as string[])];
}

/** Props comunes para el formulario de gastos de un viaje. */
export function expenseFormBase(b: TripBundle, rates: Record<string, { rate: number; date: string }>) {
  return {
    baseCurrency: b.trip.baseCurrency,
    travelers: b.travelers.map((t) => ({ id: t.id, name: t.name })),
    destinations: formContext(b).destinations ?? [],
    rates,
  };
}

/** Indica si una reserva ya tiene un gasto asociado. */
export function hasExpense(b: TripBundle, sourceType: string, sourceId: string): boolean {
  return b.expenses.some((e) => e.sourceType === sourceType && e.sourceId === sourceId);
}

/** Ciudad que se usa para buscar la foto de portada del viaje (la primera con nombre). */
export function tripPhotoQuery(b: TripBundle): string | null {
  const d = b.destinations[0];
  if (d) return d.country ? `${d.city} ${d.country}` : d.city;
  const l = b.lodgings.find((x) => x.city);
  return l?.city ?? null;
}

export function destinationPhotoQuery(d: { city: string; country: string | null }): string {
  return d.country ? `${d.city} ${d.country}` : d.city;
}
