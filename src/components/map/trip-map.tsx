
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { ExternalLink, Locate } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { MapContainer, Marker, Polyline, Popup, TileLayer, Tooltip, useMap } from "react-leaflet";
import {
  estimateMinutes,
  formatKm,
  googleMapsDirectionsUrl,
  haversineKm,
  TRAVEL_MODES,
  type LatLng,
  type TravelMode,
} from "@/lib/domain/geo";
import { formatDuration } from "@/lib/domain/dates";
import { POINT_LABELS, type MapLine, type MapPoint, type PointKind } from "@/lib/domain/map-points";
import { buttonStyles, cx } from "../ui";

export const KIND_STYLE: Record<PointKind, { color: string; glyph: string }> = {
  destination: { color: "#0f766e", glyph: "📍" },
  lodging: { color: "#7c3aed", glyph: "🛏️" },
  airport: { color: "#2563eb", glyph: "✈️" },
  station: { color: "#0891b2", glyph: "🚆" },
  activity: { color: "#d97706", glyph: "🎟️" },
  restaurant: { color: "#dc2626", glyph: "🍽️" },
};

const LINE_STYLE: Record<MapLine["kind"], L.PathOptions> = {
  route: { color: "#0f766e", weight: 3, opacity: 0.7 },
  flight: { color: "#2563eb", weight: 2, opacity: 0.6, dashArray: "6 6" },
  transport: { color: "#0891b2", weight: 3, opacity: 0.7, dashArray: "2 6" },
};

const iconCache = new Map<string, L.DivIcon>();
function iconFor(kind: PointKind, selected: boolean): L.DivIcon {
  const key = `${kind}-${selected}`;
  let icon = iconCache.get(key);
  if (!icon) {
    const { color, glyph } = KIND_STYLE[kind];
    const size = selected ? 36 : 30;
    icon = L.divIcon({
      className: "",
      html: `<div style="width:${size}px;height:${size}px;border-radius:9999px;background:${color};border:3px solid ${selected ? "#facc15" : "white"};box-shadow:0 1px 4px rgba(0,0,0,.4);display:grid;place-items:center;font-size:${selected ? 17 : 14}px;line-height:1">${glyph}</div>`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      popupAnchor: [0, -size / 2],
    });
    iconCache.set(key, icon);
  }
  return icon;
}

type Located = MapPoint & LatLng;

function FitBounds({ points, focus }: { points: Located[]; focus: string }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 13);
      return;
    }
    map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng])), { padding: [40, 40], maxZoom: 15 });
    // Solo se reencuadra al cambiar el foco, no en cada actualización.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, map]);
  return null;
}

export default function TripMap({ points, lines, destinations }: { points: MapPoint[]; lines: MapLine[]; destinations: { id: string; city: string; lat: number | null; lng: number | null }[] }) {
  const located = useMemo(() => points.filter((p): p is Located => p.lat !== null && p.lng !== null), [points]);
  const kinds = useMemo(() => [...new Set(located.map((p) => p.kind))], [located]);
  // Se guardan las capas ocultas: así las capas nuevas (tras ubicar lugares) aparecen visibles.
  const [hidden, setHidden] = useState<Set<PointKind>>(() => new Set());
  const visible = { has: (k: PointKind) => !hidden.has(k) };
  const [focus, setFocus] = useState("all");
  const [fromKey, setFromKey] = useState<string>("");
  const [toKey, setToKey] = useState<string>("");
  const [showLines, setShowLines] = useState(true);

  const focusDest = destinations.find((d) => d.id === focus);
  const shown = located.filter((p) => {
    if (!visible.has(p.kind)) return false;
    if (!focusDest || focusDest.lat === null || focusDest.lng === null) return true;
    // Al centrar en una ciudad se muestran los lugares a menos de 40 km.
    return p.destinationId === focusDest.id || haversineKm(p, { lat: focusDest.lat, lng: focusDest.lng! }) < 40;
  });

  const from = located.find((p) => p.key === fromKey) ?? null;
  const to = located.find((p) => p.key === toKey) ?? null;
  const km = from && to ? haversineKm(from, to) : null;

  const nearby = from
    ? located
        .filter((p) => p.key !== from.key && p.kind !== "destination")
        .map((p) => ({ p, km: haversineKm(from, p) }))
        .filter((x) => x.km < 25)
        .sort((a, b) => a.km - b.km)
        .slice(0, 8)
    : [];

  if (located.length === 0) return null;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {kinds.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() =>
                setHidden((v) => {
                  const n = new Set(v);
                  if (n.has(k)) n.delete(k);
                  else n.add(k);
                  return n;
                })
              }
              className={cx("flex items-center gap-1.5 rounded-full border px-3 py-1", visible.has(k) ? "border-line bg-surface text-ink" : "border-dashed border-line text-muted opacity-60")}
              aria-pressed={visible.has(k)}
            >
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: KIND_STYLE[k].color }} />
              {POINT_LABELS[k]} ({located.filter((p) => p.kind === k).length})
            </button>
          ))}
          <label className="ml-auto flex items-center gap-1.5 text-muted">
            <input type="checkbox" checked={showLines} onChange={(e) => setShowLines(e.target.checked)} className="accent-[var(--color-accent)]" />
            Rutas
          </label>
          {destinations.length > 1 && (
            <select value={focus} onChange={(e) => setFocus(e.target.value)} className="field max-w-[12rem] py-1" aria-label="Centrar en ciudad">
              <option value="all">Todo el viaje</option>
              {destinations
                .filter((d) => d.lat !== null)
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.city}
                  </option>
                ))}
            </select>
          )}
        </div>
        <div className="h-[60vh] min-h-[22rem] overflow-hidden rounded-xl border border-line">
          <MapContainer center={[located[0].lat, located[0].lng]} zoom={5} className="h-full w-full" scrollWheelZoom>
            <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19} />
            <FitBounds points={shown.length ? shown : located} focus={`${focus}|${shown.length > 0}`} />
            {showLines &&
              lines.map((l) => (
                <Polyline key={l.key} positions={[l.from, l.to]} pathOptions={LINE_STYLE[l.kind]}>
                  <Tooltip sticky>{l.label}</Tooltip>
                </Polyline>
              ))}
            {from && to && <Polyline positions={[[from.lat, from.lng], [to.lat, to.lng]]} pathOptions={{ color: "#facc15", weight: 4 }} />}
            {shown.map((p) => (
              <Marker
                key={p.key}
                position={[p.lat, p.lng]}
                icon={iconFor(p.kind, p.key === fromKey || p.key === toKey)}
                eventHandlers={{
                  click: () => {
                    if (!fromKey || fromKey === p.key) setFromKey(p.key);
                    else setToKey(p.key);
                  },
                }}
              >
                <Popup>
                  <strong>{p.label}</strong>
                  {p.sub && <div style={{ fontSize: 12, opacity: 0.75 }}>{p.sub}</div>}
                  <div style={{ fontSize: 12, marginTop: 4 }}>{POINT_LABELS[p.kind]}</div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
        <p className="text-xs text-muted">Pulsa un marcador para elegir el origen y otro para el destino. Mapa: © OpenStreetMap.</p>
      </div>

      <aside className="space-y-4">
        <div className="rounded-xl border border-line bg-surface p-4">
          <p className="mb-2 text-sm font-semibold">Distancia y tiempo de traslado</p>
          <div className="space-y-2">
            <PointSelect label="Desde" value={fromKey} onChange={setFromKey} points={located} />
            <PointSelect label="Hasta" value={toKey} onChange={setToKey} points={located} />
          </div>
          {from && to && km !== null && (
            <div className="mt-3 space-y-1.5 text-sm">
              <p>
                Distancia en línea recta: <strong>{formatKm(km)}</strong>
              </p>
              {km < 300 &&
                (Object.keys(TRAVEL_MODES) as TravelMode[]).map((m) => (
                  <p key={m} className="flex justify-between gap-2">
                    <span className="text-muted">{TRAVEL_MODES[m].label}</span>
                    <span className="tabular-nums">~{formatDuration(estimateMinutes(km, m))}</span>
                  </p>
                ))}
              <p className="text-xs text-muted">Tiempos aproximados calculados a partir de la distancia, no de rutas reales.</p>
              <div className="flex flex-wrap gap-2 pt-1">
                {(["walking", "transit", "driving"] as TravelMode[]).map((m) => (
                  <a key={m} href={googleMapsDirectionsUrl(from, to, m)} target="_blank" rel="noreferrer" className={cx(buttonStyles.secondary, "px-2.5 py-1 text-xs")}>
                    {TRAVEL_MODES[m].label} <ExternalLink size={11} />
                  </a>
                ))}
              </div>
              <p className="text-xs text-muted">Los botones abren la ruta real en Google Maps.</p>
            </div>
          )}
        </div>

        {from && nearby.length > 0 && (
          <div className="rounded-xl border border-line bg-surface p-4">
            <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
              <Locate size={15} /> Cerca de {from.label}
            </p>
            <ul className="space-y-1.5 text-sm">
              {nearby.map(({ p, km: d }) => (
                <li key={p.key}>
                  <button type="button" onClick={() => setToKey(p.key)} className="flex w-full items-start gap-2 rounded-md px-1 py-0.5 text-left hover:bg-surface-2">
                    <span aria-hidden>{KIND_STYLE[p.kind].glyph}</span>
                    <span className="min-w-0 flex-1 truncate">{p.label}</span>
                    <span className="shrink-0 text-xs tabular-nums text-muted">
                      {formatKm(d)} · {d < 3 ? `${estimateMinutes(d, "walking")} min a pie` : `~${estimateMinutes(d, "transit")} min`}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </aside>
    </div>
  );
}

function PointSelect({ label, value, onChange, points }: { label: string; value: string; onChange: (v: string) => void; points: Located[] }) {
  const groups = (Object.keys(POINT_LABELS) as PointKind[]).map((k) => [k, points.filter((p) => p.kind === k)] as const).filter(([, list]) => list.length);
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-muted">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="field">
        <option value="">Elige un lugar…</option>
        {groups.map(([k, list]) => (
          <optgroup key={k} label={POINT_LABELS[k]}>
            {list.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}
