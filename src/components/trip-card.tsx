import { CalendarDays, MapPin, Users, Wallet } from "lucide-react";
import { Link } from "react-router";
import { formatDate, tripDays, tripPhase } from "@/lib/domain/dates";
import { formatMoney } from "@/lib/domain/money";
import type { TripBundle } from "@/lib/domain/types";
import { TRIP_PHASE } from "@/lib/labels";
import { tripCities, tripCountries, tripPhotoQuery } from "@/lib/trip-helpers";
import { useCityPhoto } from "@/lib/photos";
import { DeleteButton } from "./delete-button";
import { Badge, Card, type Tone } from "./ui";

const PHASE_TONE: Record<string, Tone> = { futuro: "accent", en_curso: "success", finalizado: "neutral", cancelado: "danger" };

/**
 * Portada: la imagen del viaje si la hay; si no, una foto de la ciudad principal
 * (Wikimedia Commons) y, mientras carga o si falla, un degradado de color.
 */
export function TripCover({
  name,
  image,
  query,
  className,
  credit = false,
}: {
  name: string;
  image: string | null;
  query?: string | null;
  className?: string;
  credit?: boolean;
}) {
  const { photo } = useCityPhoto(image ? null : query);
  const src = image ?? photo?.url ?? null;
  // Degradado determinista a partir del nombre (fondo mientras carga la foto).
  const hue = [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
  return (
    <div
      className={`relative grid place-items-center overflow-hidden text-2xl font-semibold text-white/90 ${className ?? ""}`}
      style={{ background: `linear-gradient(135deg, hsl(${hue} 55% 42%), hsl(${(hue + 40) % 360} 60% 32%))` }}
    >
      {src ? (
        <img src={src} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <span aria-hidden>
          {name
            .split(/\s+/)
            .slice(0, 2)
            .map((w) => w[0]?.toUpperCase())
            .join("")}
        </span>
      )}
      {credit && photo && !image && (
        <a
          href={photo.pageUrl}
          target="_blank"
          rel="noreferrer"
          className="absolute bottom-1 right-2 z-10 text-[10px] font-normal text-white/70 hover:text-white"
          onClick={(e) => e.stopPropagation()}
        >
          Foto: Wikimedia Commons
        </a>
      )}
    </div>
  );
}

/** `onDelete`: muestra un botón de eliminar sobre la portada (con confirmación). */
export function TripCard({ bundle, today, onDelete }: { bundle: TripBundle; today: string; onDelete?: () => Promise<void> }) {
  const { trip } = bundle;
  const phase = tripPhase(trip, today);
  const cities = tripCities(bundle);
  const countries = tripCountries(bundle);
  return (
    <div className="relative">
      <Link to={`/trips/${trip.id}`} className="group block">
        <Card className="overflow-hidden transition group-hover:shadow-md group-hover:border-accent/40">
          <TripCover name={trip.name} image={trip.coverImage} query={tripPhotoQuery(bundle)} className="h-36 w-full" />
          <div className="space-y-2 p-4">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold leading-tight">{trip.name}</h3>
              <Badge tone={PHASE_TONE[phase]}>{TRIP_PHASE[phase]}</Badge>
            </div>
            {(cities.length > 0 || countries.length > 0) && (
              <p className="flex items-center gap-1.5 truncate text-sm text-muted">
                <MapPin size={14} className="shrink-0" />
                {cities.length ? cities.join(" · ") : countries.join(" · ")}
              </p>
            )}
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
              <span className="flex items-center gap-1">
                <CalendarDays size={13} />
                {formatDate(trip.startDate, "d MMM")} – {formatDate(trip.endDate)} · {tripDays(trip.startDate, trip.endDate)} días
              </span>
              {bundle.travelers.length > 0 && (
                <span className="flex items-center gap-1">
                  <Users size={13} />
                  {bundle.travelers.length}
                </span>
              )}
              {trip.budgetMinor !== null && (
                <span className="flex items-center gap-1">
                  <Wallet size={13} />
                  {formatMoney(trip.budgetMinor, trip.baseCurrency)}
                </span>
              )}
            </div>
          </div>
        </Card>
      </Link>
      {onDelete && (
        // Fuera del enlace: así el diálogo de confirmación no abre el viaje al pulsarlo.
        <DeleteButton
          itemName={`el viaje «${trip.name}»`}
          warning="Se borrarán todas sus reservas, gastos y documentos."
          action={onDelete}
          className="absolute right-2 top-2 !bg-surface/90 !text-ink shadow-sm backdrop-blur hover:!bg-surface"
        />
      )}
    </div>
  );
}
