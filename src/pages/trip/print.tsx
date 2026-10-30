import { Printer } from "lucide-react";
import { useState } from "react";
import { eventsOf } from "@/components/trip-timeline";
import { buttonStyles, PageHeader } from "@/components/ui";
import { formatDate, formatDateTimeLocal, tripDays } from "@/lib/domain/dates";
import { buildItinerary } from "@/lib/domain/itinerary";
import { BOOKING_STATUS, TRANSPORT_TYPE } from "@/lib/labels";
import { tripCities } from "@/lib/trip-helpers";
import { useTrip } from "@/pages/trip/context";

/** Itinerario para imprimir o guardar como PDF con el diálogo del navegador. */
export default function PrintPage() {
  const { b, tripId } = useTrip();
  const [withCodes, setWithCodes] = useState(false);
  const { trip } = b;
  const days = buildItinerary(b);
  const active = <T extends { bookingStatus: string }>(list: T[]) => list.filter((x) => x.bookingStatus !== "cancelado");
  const code = (c: string | null) => (withCodes && c ? ` · Código: ${c}` : "");

  return (
    <div>
      <div className="print:hidden">
        <PageHeader
          title="Itinerario en PDF"
          subtitle="Una copia en papel o en tu teléfono por si no tienes conexión. En el diálogo elige «Guardar como PDF»."
          actions={
            <button type="button" className={buttonStyles.primary} onClick={() => window.print()}>
              <Printer size={16} /> Guardar como PDF
            </button>
          }
        />
        <label className="mb-5 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={withCodes} onChange={(e) => setWithCodes(e.target.checked)} />
          Incluir códigos de reserva (quien vea el PDF podrá verlos)
        </label>
      </div>

      <article className="space-y-6 rounded-xl border border-line bg-surface p-5 print:border-0 print:p-0">
        <header>
          <h1 className="text-2xl font-bold">{trip.name}</h1>
          <p className="text-sm text-muted">
            {formatDate(trip.startDate, "d MMM")} – {formatDate(trip.endDate)} · {tripDays(trip.startDate, trip.endDate)} días
            {b.travelers.length > 0 && ` · ${b.travelers.map((t) => t.name).join(", ")}`}
          </p>
          {tripCities(b).length > 0 && <p className="text-sm">{tripCities(b).join(" → ")}</p>}
        </header>

        <section>
          <h2 className="mb-2 border-b border-line pb-1 text-base font-semibold">Día a día</h2>
          {days.map((day) => (
            <div key={day.date} className="break-inside-avoid border-b border-line py-2 last:border-0">
              <p className="text-sm font-semibold first-letter:uppercase">
                {formatDate(day.date, "EEEE d MMM")}
                <span className="font-normal text-muted"> · Día {day.dayNumber}{day.destinations.length > 0 && ` · ${day.destinations.map((d) => d.city).join(", ")}`}</span>
              </p>
              <ul className="mt-0.5 text-sm">
                {eventsOf(day, tripId, trip.baseCurrency).map((e) => (
                  <li key={e.key}>
                    <span className="inline-block w-12 tabular-nums text-muted">{e.time ?? ""}</span>
                    {e.title}
                    {e.detail && <span className="text-muted"> · {e.detail}</span>}
                    {e.status && e.status !== "confirmado" && <span className="text-muted"> ({BOOKING_STATUS[e.status]})</span>}
                  </li>
                ))}
                <li className="text-muted">
                  <span className="inline-block w-12" />
                  {day.lodging ? `Duermes en ${day.lodging.name}` : day.overnightTransit ? "Noche en tránsito" : day.dayNumber < days.length ? "Sin alojamiento registrado" : ""}
                </li>
              </ul>
            </div>
          ))}
        </section>

        {active(b.flights).length > 0 && (
          <section className="break-inside-avoid">
            <h2 className="mb-2 border-b border-line pb-1 text-base font-semibold">Vuelos</h2>
            <ul className="space-y-1 text-sm">
              {active(b.flights).map((f) => (
                <li key={f.id}>
                  <strong>{[f.airline, f.flightNumber].filter(Boolean).join(" ") || "Vuelo"}</strong> · {f.originCode ?? f.originName ?? "?"} → {f.destinationCode ?? f.destinationName ?? "?"} · {formatDateTimeLocal(f.departureLocal)}
                  {f.terminalOrigin && ` · Terminal ${f.terminalOrigin}`}
                  {f.seats && ` · Asiento ${f.seats}`}
                  {code(f.bookingCode)}
                </li>
              ))}
            </ul>
          </section>
        )}

        {active(b.lodgings).length > 0 && (
          <section className="break-inside-avoid">
            <h2 className="mb-2 border-b border-line pb-1 text-base font-semibold">Alojamientos</h2>
            <ul className="space-y-1 text-sm">
              {active(b.lodgings).map((l) => (
                <li key={l.id}>
                  <strong>{l.name}</strong> · {formatDate(l.checkInDate, "d MMM")} – {formatDate(l.checkOutDate, "d MMM")}
                  {l.address && ` · ${l.address}`}
                  {l.city && `, ${l.city}`}
                  {l.hostContact && ` · ${l.hostContact}`}
                  {code(l.bookingCode)}
                </li>
              ))}
            </ul>
          </section>
        )}

        {active(b.transports).length > 0 && (
          <section className="break-inside-avoid">
            <h2 className="mb-2 border-b border-line pb-1 text-base font-semibold">Transporte</h2>
            <ul className="space-y-1 text-sm">
              {active(b.transports).map((t) => (
                <li key={t.id}>
                  <strong>{TRANSPORT_TYPE[t.type]}</strong> · {t.origin ?? "?"} → {t.destination ?? "?"} · {formatDateTimeLocal(t.departureLocal)}
                  {t.operator && ` · ${t.operator}`}
                  {t.bookingStatus !== "confirmado" && ` (${BOOKING_STATUS[t.bookingStatus]})`}
                  {code(t.bookingCode)}
                </li>
              ))}
            </ul>
          </section>
        )}
      </article>
    </div>
  );
}
