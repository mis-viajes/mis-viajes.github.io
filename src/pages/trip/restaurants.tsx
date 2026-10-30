import { useSearchParams } from "react-router";
import { useTrip } from "@/pages/trip/context";
import { ExternalLink, MapPin, Star, Utensils } from "lucide-react";
import { deleteEntity, saveEntity } from "@/lib/api";
import { DeleteButton } from "@/components/delete-button";
import { RecordDialog } from "@/components/record-dialog";
import { Badge, Card, EmptyState, FilterChip, PageHeader, type Tone } from "@/components/ui";
import { formatDateTimeLocal } from "@/lib/domain/dates";
import { RESTAURANT_STATUS } from "@/lib/labels";
import { destinationName, formContext } from "@/lib/trip-helpers";
import type { Restaurant } from "@/lib/types";

const STATUS_TONE: Record<string, Tone> = { por_visitar: "neutral", recomendado: "info", reservado: "warning", visitado: "success" };

export default function RestaurantsPage() {
  const { b, tripId } = useTrip();
  const [searchParams] = useSearchParams();
  const lista = searchParams.get("lista") ?? undefined;
  const ctx = formContext(b);
  const ciudad = searchParams.get("ciudad") ?? undefined;
  const cocina = searchParams.get("cocina") ?? undefined;
  const cityOf = (r: Restaurant) => r.city ?? destinationName(b, r.destinationId) ?? null;
  const list = b.restaurants.filter((r) => (!lista || r.listStatus === lista) && (!ciudad || cityOf(r) === ciudad) && (!cocina || r.cuisine === cocina));
  const unique = (values: (string | null)[]) => [...new Set(values.filter((v): v is string => Boolean(v)))].sort((x, y) => x.localeCompare(y, "es"));
  const cities = unique(b.restaurants.map(cityOf));
  const cuisines = unique(b.restaurants.map((r) => r.cuisine));
  const href = (q: Record<string, string | undefined>) => {
    const p = new URLSearchParams(Object.entries({ lista, ciudad, cocina, ...q }).filter(([, v]) => v) as [string, string][]);
    return `/trips/${tripId}/restaurants${p.size ? `?${p}` : ""}`;
  };

  return (
    <div>
      <PageHeader
        title="Restaurantes"
        subtitle="Lugares por visitar, recomendados, reservados y visitados."
        actions={<RecordDialog entity="restaurant" action={saveEntity.bind(null, "restaurant", tripId, null, null)} context={ctx} />}
      />
      {b.restaurants.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2 text-sm">
          {[["", "Todos"], ...Object.entries(RESTAURANT_STATUS)].map(([value, label]) => {
            const count = value ? b.restaurants.filter((r) => r.listStatus === value).length : b.restaurants.length;
            const active = (lista ?? "") === value;
            return (
              <FilterChip key={value} href={href({ lista: value || undefined })} active={active}>
                {label} ({count})
              </FilterChip>
            );
          })}
        </div>
      )}
      {(cities.length > 1 || cuisines.length > 1) && (
        <div className="mb-4 flex flex-wrap gap-2 text-sm">
          {cities.length > 1 && (
            <>
              <FilterChip href={href({ ciudad: undefined })} active={!ciudad}>Todas las ciudades</FilterChip>
              {cities.map((c) => <FilterChip key={c} href={href({ ciudad: c })} active={ciudad === c}>{c}</FilterChip>)}
            </>
          )}
          {cities.length > 1 && cuisines.length > 1 && <span className="mx-1 self-center text-line">|</span>}
          {cuisines.length > 1 && (
            <>
              <FilterChip href={href({ cocina: undefined })} active={!cocina}>Toda la gastronomía</FilterChip>
              {cuisines.map((c) => <FilterChip key={c} href={href({ cocina: c })} active={cocina === c}>{c}</FilterChip>)}
            </>
          )}
        </div>
      )}
      {b.restaurants.length === 0 ? (
        <EmptyState icon={<Utensils size={32} />} title="Sin restaurantes guardados">
          Guarda los restaurantes que quieres probar y marca cuáles reservaste o visitaste.
        </EmptyState>
      ) : list.length === 0 ? (
        <Card className="p-4 text-sm text-muted">Ningún restaurante coincide con el filtro.</Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {list.map((r) => (
            <Card key={r.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-medium">{r.name}</h3>
                    <Badge tone={STATUS_TONE[r.listStatus]}>{RESTAURANT_STATUS[r.listStatus]}</Badge>
                  </div>
                  <p className="mt-0.5 text-sm text-muted">{[r.cuisine, r.priceRange].filter(Boolean).join(" · ")}</p>
                </div>
                <div className="flex shrink-0 items-center">
                  <RecordDialog entity="restaurant" mode="edit" action={saveEntity.bind(null, "restaurant", tripId, r.id, null)} initial={r} context={ctx} />
                  <DeleteButton itemName={r.name} action={deleteEntity.bind(null, "restaurant", tripId, r.id, null)} />
                </div>
              </div>
              <div className="mt-2 space-y-1 text-sm">
                {(r.address || r.city || r.destinationId) && (
                  <p className="flex items-center gap-1 text-muted">
                    <MapPin size={13} /> {[r.address, r.city ?? destinationName(b, r.destinationId)].filter(Boolean).join(", ")}
                  </p>
                )}
                {r.reservedAt && <p>Reserva: {formatDateTimeLocal(r.reservedAt)}</p>}
                {r.requiresBooking && !r.reservedAt && <p className="text-warning">Necesita reserva</p>}
                {r.rating && (
                  <p className="flex items-center gap-0.5 text-warning" aria-label={`${r.rating} de 5`}>
                    {Array.from({ length: r.rating }, (_, i) => (
                      <Star key={i} size={13} fill="currentColor" />
                    ))}
                  </p>
                )}
                {r.openingHours && <p className="text-muted">Horario: {r.openingHours}</p>}
                {r.notes && <p className="text-muted">{r.notes}</p>}
                <div className="flex gap-3">
                  {r.mapsUrl && (
                    <a href={r.mapsUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline">
                      Google Maps <ExternalLink size={12} />
                    </a>
                  )}
                  {r.website && (
                    <a href={r.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline">
                      Sitio web <ExternalLink size={12} />
                    </a>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
