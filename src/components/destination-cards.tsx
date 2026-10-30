import { BedDouble } from "lucide-react";
import { Link } from "react-router";
import { formatDate, nightsBetween } from "@/lib/domain/dates";
import type { TripBundle } from "@/lib/domain/types";
import { useCityPhoto } from "@/lib/photos";
import type { Destination } from "@/lib/types";
import { destinationPhotoQuery } from "@/lib/trip-helpers";

function DestinationCard({ d, index, tripId, lodging }: { d: Destination; index: number; tripId: string; lodging: string | null }) {
  const { photo } = useCityPhoto(destinationPhotoQuery(d));
  const nights = nightsBetween(d.arrivalDate, d.departureDate);
  const hue = [...d.city].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 11);
  return (
    <Link
      to={`/trips/${tripId}/destinations`}
      className="group relative block h-44 w-48 shrink-0 snap-start overflow-hidden rounded-xl text-white shadow-sm sm:w-56"
      style={{ background: `linear-gradient(135deg, hsl(${hue} 50% 40%), hsl(${(hue + 50) % 360} 55% 28%))` }}
    >
      {photo && <img src={photo.url} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105" />}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
      <span className="absolute left-3 top-3 grid h-7 w-7 place-items-center rounded-full bg-white/90 text-xs font-bold text-ink">{index + 1}</span>
      <div className="absolute inset-x-0 bottom-0 p-3">
        <p className="text-lg font-bold leading-tight drop-shadow">{d.city}</p>
        <p className="text-xs text-white/85">
          {d.arrivalDate && d.departureDate
            ? `${formatDate(d.arrivalDate, "d MMM")} → ${formatDate(d.departureDate, "d MMM")}`
            : d.arrivalDate
              ? `desde ${formatDate(d.arrivalDate, "d MMM")}`
              : d.departureDate
                ? `hasta ${formatDate(d.departureDate, "d MMM")}`
                : (d.country ?? "")}
          {nights !== null && ` · ${nights} ${nights === 1 ? "noche" : "noches"}`}
        </p>
        {lodging && (
          <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-white/85">
            <BedDouble size={12} /> {lodging}
          </p>
        )}
      </div>
    </Link>
  );
}

/** Fila desplazable de destinos con foto, en orden de visita. */
export function DestinationCards({ bundle }: { bundle: TripBundle }) {
  if (bundle.destinations.length === 0) return null;
  return (
    <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
      {bundle.destinations.map((d, i) => {
        const lodging =
          bundle.lodgings.find((l) => l.destinationId === d.id) ??
          bundle.lodgings.find((l) => !l.destinationId && l.city && l.city.toLowerCase() === d.city.toLowerCase());
        return <DestinationCard key={d.id} d={d} index={i} tripId={bundle.trip.id} lodging={lodging?.name ?? null} />;
      })}
    </div>
  );
}
