import { Search } from "lucide-react";
import { Link, useSearchParams } from "react-router";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { searchBundles, type SearchKind } from "@/lib/domain/search";
import { useAllBundles } from "@/lib/hooks";
import { DataError, LoadingSkeleton } from "./status";

const KIND_LABEL: Record<SearchKind, string> = {
  viaje: "Viaje",
  destino: "Destino",
  vuelo: "Vuelo",
  alojamiento: "Alojamiento",
  transporte: "Transporte",
  actividad: "Actividad",
  restaurante: "Restaurante",
  gasto: "Gasto",
  documento: "Documento",
  tarea: "Checklist",
};

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get("q") ?? "";
  const { data: bundles, loading, error } = useAllBundles();
  const results = bundles ? searchBundles(bundles, query).slice(0, 100) : [];

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Buscar" subtitle="En todos tus viajes. Los códigos de reserva no se buscan." />
      <div className="relative mb-4">
        <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          type="search"
          autoFocus
          aria-label="Buscar en todos los viajes"
          placeholder="Ciudad, hotel, vuelo, restaurante, gasto…"
          className="field !pl-9"
          value={query}
          onChange={(e) => setSearchParams(e.target.value ? { q: e.target.value } : {}, { replace: true })}
        />
      </div>
      {error && !bundles ? (
        <DataError error={error} />
      ) : loading && !bundles ? (
        <LoadingSkeleton />
      ) : !query.trim() ? (
        <EmptyState icon={<Search size={32} />} title="Escribe algo para buscar">
          Busca a la vez en destinos, vuelos, alojamientos, transporte, actividades, restaurantes, gastos, documentos y checklist.
        </EmptyState>
      ) : results.length === 0 ? (
        <Card className="p-4 text-sm text-muted">Sin resultados para «{query}».</Card>
      ) : (
        <Card className="divide-y divide-line">
          {results.map((r) => (
            <Link key={`${r.kind}-${r.id}`} to={r.href} className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{r.title}</span>
                <span className="block truncate text-xs text-muted">{[r.tripName, r.detail].filter(Boolean).join(" · ")}</span>
              </span>
              <Badge>{KIND_LABEL[r.kind]}</Badge>
            </Link>
          ))}
        </Card>
      )}
    </div>
  );
}
