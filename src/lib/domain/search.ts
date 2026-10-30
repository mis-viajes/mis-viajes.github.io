import { TRANSPORT_TYPE } from "../labels";
import type { TripBundle } from "./types";

export type SearchKind = "viaje" | "destino" | "vuelo" | "alojamiento" | "transporte" | "actividad" | "restaurante" | "gasto" | "documento" | "tarea";

export type SearchResult = { id: string; kind: SearchKind; title: string; detail: string; tripName: string; href: string };

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Busca en todos los viajes. Todas las palabras deben aparecer en el registro.
 * Los códigos de reserva e información de acceso quedan fuera a propósito: son datos sensibles.
 */
export function searchBundles(bundles: TripBundle[], query: string): SearchResult[] {
  const words = norm(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const out: SearchResult[] = [];
  for (const b of bundles) {
    const base = `/trips/${b.trip.id}`;
    const add = (id: string, kind: SearchKind, title: string, detail: (string | null)[], section: string, extra: (string | null)[] = []) => {
      const text = norm([title, ...detail, ...extra].filter(Boolean).join(" "));
      if (words.every((w) => text.includes(w))) {
        out.push({ id, kind, title, detail: detail.filter(Boolean).join(" · "), tripName: b.trip.name, href: `${base}${section}` });
      }
    };
    add(b.trip.id, "viaje", b.trip.name, [b.trip.description], "", [b.trip.notes]);
    for (const d of b.destinations) add(d.id, "destino", d.city, [d.country], "/destinations", [d.notes]);
    for (const f of b.flights) {
      add(f.id, "vuelo", [f.airline, f.flightNumber].filter(Boolean).join(" ") || "Vuelo", [`${f.originCode ?? f.originName ?? "?"} → ${f.destinationCode ?? f.destinationName ?? "?"}`], "/flights", [f.originName, f.destinationName, f.notes]);
    }
    for (const l of b.lodgings) add(l.id, "alojamiento", l.name, [l.city, l.address], "/lodging", [l.platform, l.notes]);
    for (const t of b.transports) {
      add(t.id, "transporte", `${t.origin ?? "?"} → ${t.destination ?? "?"}`, [TRANSPORT_TYPE[t.type], t.operator], "/transport", [t.serviceNumber, t.notes]);
    }
    for (const a of b.activities) add(a.id, "actividad", a.name, [a.city, a.date], "/activities", [a.address, a.description, a.notes]);
    for (const r of b.restaurants) add(r.id, "restaurante", r.name, [r.city, r.cuisine], "/restaurants", [r.address, r.notes]);
    for (const e of b.expenses) add(e.id, "gasto", e.description, [e.date], "/finance", [e.notes]);
    for (const d of b.documents) add(d.id, "documento", d.title, [d.fileName], "/documents", [d.notes]);
    for (const c of b.checklist) add(c.id, "tarea", c.title, [c.groupName], `/checklist?lista=${c.list}`, [c.notes]);
  }
  return out;
}
