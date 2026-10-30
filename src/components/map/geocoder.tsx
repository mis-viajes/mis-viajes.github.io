
import { MapPinOff, Search } from "lucide-react";
import { useState, useTransition } from "react";
import type { CoordUpdate } from "@/lib/api";
import type { MapPoint } from "@/lib/domain/map-points";
import { POINT_LABELS } from "@/lib/domain/map-points";
import { buttonStyles } from "../ui";

type Candidate = { display_name: string; lat: string; lon: string };
type Row = { point: MapPoint; query: string; candidates: Candidate[] | null; choice: number; keep: boolean; error?: string };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Busca coordenadas para los lugares que no las tienen usando Nominatim (OpenStreetMap).
 * Respeta su política de uso: peticiones de una en una, con 1,1 s de separación.
 * El usuario revisa cada resultado antes de guardarlo.
 */
export function Geocoder({ missing, save }: { missing: MapPoint[]; save: (updates: CoordUpdate[]) => Promise<void> }) {
  const [rows, setRows] = useState<Row[]>(() => missing.map((point) => ({ point, query: point.query, candidates: null, choice: 0, keep: true })));
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [saving, startSaving] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const update = (i: number, patch: Partial<Row>) => setRows((r) => r.map((row, j) => (j === i ? { ...row, ...patch } : row)));

  const searchAll = async () => {
    setRunning(true);
    setMessage(null);
    for (let i = 0; i < rows.length; i++) {
      const q = rows[i].query.trim();
      setProgress(i + 1);
      if (!q) {
        update(i, { candidates: [], error: "Sin texto de búsqueda" });
        continue;
      }
      try {
        const params = new URLSearchParams({ q, format: "json", limit: "3", "accept-language": "es" });
        const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`);
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as Candidate[];
        update(i, { candidates: data, choice: 0, keep: data.length > 0, error: data.length ? undefined : "Sin resultados" });
      } catch {
        update(i, { candidates: [], keep: false, error: "Error de conexión" });
      }
      if (i < rows.length - 1) await sleep(1100);
    }
    setRunning(false);
  };

  const selected = rows.filter((r) => r.keep && r.candidates && r.candidates[r.choice]);

  const saveSelected = () =>
    startSaving(async () => {
      const updates: CoordUpdate[] = selected.flatMap((r) => {
        const c = r.candidates![r.choice];
        return r.point.refs.map((ref) => ({ ...ref, lat: Number(c.lat), lng: Number(c.lon) }));
      });
      await save(updates);
      setMessage(`${selected.length} ${selected.length === 1 ? "ubicación guardada" : "ubicaciones guardadas"}.`);
      setRows((r) => r.filter((row) => !selected.includes(row)));
    });

  if (rows.length === 0) return message ? <p className="text-sm text-success">{message}</p> : null;

  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <MapPinOff size={15} /> {rows.length} {rows.length === 1 ? "lugar sin ubicación" : "lugares sin ubicación"}
          </p>
          <p className="text-xs text-muted">Revisa el texto de búsqueda, busca y confirma los resultados antes de guardarlos.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" className={buttonStyles.secondary} onClick={searchAll} disabled={running}>
            <Search size={15} /> {running ? `Buscando ${progress}/${rows.length}…` : "Buscar ubicaciones"}
          </button>
          {selected.length > 0 && (
            <button type="button" className={buttonStyles.primary} onClick={saveSelected} disabled={saving || running}>
              {saving ? "Guardando…" : `Guardar ${selected.length}`}
            </button>
          )}
        </div>
      </div>
      <ul className="divide-y divide-line">
        {rows.map((r, i) => (
          <li key={r.point.key} className="grid gap-2 py-2.5 sm:grid-cols-[12rem_1fr]">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{r.point.label}</p>
              <p className="text-xs text-muted">{POINT_LABELS[r.point.kind]}</p>
            </div>
            <div className="space-y-1.5">
              <input className="field py-1.5" value={r.query} onChange={(e) => update(i, { query: e.target.value, candidates: null })} aria-label={`Búsqueda para ${r.point.label}`} />
              {r.error && <p className="text-xs text-warning">{r.error}</p>}
              {r.candidates && r.candidates.length > 0 && (
                <div className="space-y-1">
                  {r.candidates.map((c, j) => (
                    <label key={j} className="flex items-start gap-2 text-xs">
                      <input type="radio" name={`c-${r.point.key}`} checked={r.choice === j && r.keep} onChange={() => update(i, { choice: j, keep: true })} className="mt-0.5 accent-[var(--color-accent)]" />
                      <span>{c.display_name}</span>
                    </label>
                  ))}
                  <label className="flex items-center gap-2 text-xs text-muted">
                    <input type="radio" name={`c-${r.point.key}`} checked={!r.keep} onChange={() => update(i, { keep: false })} className="accent-[var(--color-accent)]" />
                    Ninguno es correcto
                  </label>
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
      {message && <p className="mt-2 text-sm text-success">{message}</p>}
      <p className="mt-2 text-xs text-muted">Búsqueda: © colaboradores de OpenStreetMap (Nominatim).</p>
    </div>
  );
}
