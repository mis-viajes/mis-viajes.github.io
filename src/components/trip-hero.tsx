import { CalendarDays, ImageIcon, MapPin, Users } from "lucide-react";
import type { ReactNode } from "react";
import { daysUntil, formatDate, todayISO, tripDays, tripPhase } from "@/lib/domain/dates";
import type { TripBundle } from "@/lib/domain/types";
import { TRIP_PHASE } from "@/lib/labels";
import { useCityPhoto } from "@/lib/photos";
import { tripCities, tripPhotoQuery } from "@/lib/trip-helpers";

/** Portada grande del viaje con foto, fase, cuenta atrás y ruta de ciudades. */
export function TripHero({ bundle, actions }: { bundle: TripBundle; actions?: ReactNode }) {
  const { trip } = bundle;
  const today = todayISO();
  const phase = tripPhase(trip, today);
  const { photo, next } = useCityPhoto(trip.coverImage ? null : tripPhotoQuery(bundle));
  const src = trip.coverImage ?? photo?.url ?? null;
  const cities = tripCities(bundle);
  const total = tripDays(trip.startDate, trip.endDate);
  const until = daysUntil(trip.startDate, today);
  const hue = [...trip.name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);

  const countdown =
    phase === "en_curso"
      ? { big: `Día ${-until + 1}`, small: `de ${total}` }
      : phase === "futuro"
        ? until === 0
          ? { big: "¡Hoy!", small: "empieza el viaje" }
          : { big: String(until), small: until === 1 ? "día para salir" : "días para salir" }
        : null;

  return (
    <div
      className="relative mb-4 overflow-hidden rounded-2xl text-white shadow-sm"
      style={{ background: `linear-gradient(135deg, hsl(${hue} 55% 38%), hsl(${(hue + 40) % 360} 60% 26%))` }}
    >
      {src && <img src={src} alt="" className="absolute inset-0 h-full w-full object-cover" />}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-black/10" />
      <div className="relative flex min-h-56 flex-col justify-between gap-6 p-5 sm:min-h-64 sm:p-7">
        <div className="flex items-start justify-between gap-3">
          <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-medium backdrop-blur">{TRIP_PHASE[phase]}</span>
          <div className="flex items-center gap-2">
            {next && (
              <button
                type="button"
                onClick={next}
                className="inline-flex items-center gap-1.5 rounded-lg bg-black/30 px-2.5 py-1.5 text-xs backdrop-blur hover:bg-black/45"
                title="Mostrar otra foto de la ciudad"
              >
                <ImageIcon size={14} /> Otra foto
              </button>
            )}
            {actions}
          </div>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight drop-shadow sm:text-4xl">{trip.name}</h1>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-white/90">
              <span className="flex items-center gap-1.5">
                <CalendarDays size={15} /> {formatDate(trip.startDate, "d MMM")} – {formatDate(trip.endDate)} · {total} días
              </span>
              {bundle.travelers.length > 0 && (
                <span className="flex items-center gap-1.5">
                  <Users size={15} /> {bundle.travelers.map((t) => t.name.split(" ")[0]).join(" y ")}
                </span>
              )}
            </div>
            {cities.length > 0 && (
              <p className="mt-2 flex flex-wrap items-center gap-1.5 text-sm font-medium">
                <MapPin size={15} className="shrink-0" />
                {cities.map((c, i) => (
                  <span key={c} className="flex items-center gap-1.5">
                    {i > 0 && <span className="text-white/60">→</span>}
                    {c}
                  </span>
                ))}
              </p>
            )}
          </div>
          {countdown && (
            <div className="rounded-xl bg-white/15 px-4 py-2 text-right backdrop-blur">
              <p className="text-3xl font-bold tabular-nums leading-none sm:text-4xl">{countdown.big}</p>
              <p className="mt-1 text-xs text-white/85">{countdown.small}</p>
            </div>
          )}
        </div>
      </div>
      {photo && !trip.coverImage && (
        <a href={photo.pageUrl} target="_blank" rel="noreferrer" className="absolute bottom-1.5 right-3 text-[10px] text-white/60 hover:text-white">
          Foto: Wikimedia Commons
        </a>
      )}
    </div>
  );
}
