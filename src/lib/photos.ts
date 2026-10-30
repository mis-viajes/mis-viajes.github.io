import { useEffect, useState } from "react";

/**
 * Fotos de ciudades desde Wikimedia Commons (servicio público, sin clave, con CORS).
 * Se buscan fotos JPG apaisadas; la lista de candidatas se guarda en localStorage para
 * pedir a Commons solo una vez por ciudad. Si falla, quien la usa muestra un degradado.
 */

export type Photo = { url: string; pageUrl: string };
type Cached = { photos: Photo[]; index: number; at: number };

const API = "https://commons.wikimedia.org/w/api.php";
const KEY = (q: string) => `tm_photo:${q.toLowerCase()}`;
const MAX_AGE = 1000 * 60 * 60 * 24 * 60; // 60 días

function read(q: string): Cached | null {
  try {
    const c = JSON.parse(localStorage.getItem(KEY(q)) ?? "null") as Cached | null;
    return c && Date.now() - c.at < MAX_AGE ? c : null;
  } catch {
    return null;
  }
}

function write(q: string, c: Cached) {
  try {
    localStorage.setItem(KEY(q), JSON.stringify(c));
  } catch {
    // Sin almacenamiento: se volverá a buscar la próxima vez.
  }
}

type ApiPage = { index?: number; imageinfo?: { thumburl?: string; descriptionurl?: string; mime?: string; width?: number; height?: number }[] };

async function search(term: string): Promise<Photo[]> {
  const params = new URLSearchParams({
    action: "query",
    generator: "search",
    gsrnamespace: "6",
    gsrsearch: `${term} filetype:bitmap`,
    gsrlimit: "20",
    prop: "imageinfo",
    iiprop: "url|mime|size",
    iiurlwidth: "1600",
    format: "json",
    origin: "*",
  });
  const res = await fetch(`${API}?${params}`);
  if (!res.ok) throw new Error(String(res.status));
  const data = (await res.json()) as { query?: { pages?: Record<string, ApiPage> } };
  return Object.values(data.query?.pages ?? {})
    .sort((a, b) => (a.index ?? 99) - (b.index ?? 99))
    .map((p) => p.imageinfo?.[0])
    .filter((i): i is NonNullable<typeof i> => Boolean(i?.thumburl && i.mime === "image/jpeg" && (i.width ?? 0) >= 1000 && (i.width ?? 0) > (i.height ?? 0) * 1.25))
    .map((i) => ({ url: i.thumburl!, pageUrl: i.descriptionurl ?? "https://commons.wikimedia.org" }));
}

const inflight = new Map<string, Promise<Cached | null>>();

async function load(query: string): Promise<Cached | null> {
  const cached = read(query);
  if (cached) return cached;
  if (!inflight.has(query)) {
    inflight.set(
      query,
      (async () => {
        for (const term of [`${query} skyline`, `${query} panorama`, query]) {
          try {
            const photos = await search(term);
            if (photos.length) {
              const c = { photos: photos.slice(0, 10), index: 0, at: Date.now() };
              write(query, c);
              return c;
            }
          } catch {
            return null;
          }
        }
        return null;
      })().finally(() => inflight.delete(query)),
    );
  }
  return inflight.get(query)!;
}

/** Foto de una ciudad, con opción de pasar a la siguiente candidata. */
export function useCityPhoto(query: string | null | undefined) {
  const [state, setState] = useState<{ query: string; cached: Cached | null } | null>(null);
  useEffect(() => {
    if (!query) return;
    let cancelled = false;
    load(query).then((cached) => !cancelled && setState({ query, cached }));
    return () => {
      cancelled = true;
    };
  }, [query]);
  const cached = state && state.query === query ? state.cached : null;
  const photo = cached ? cached.photos[cached.index % cached.photos.length] : null;
  const next =
    cached && cached.photos.length > 1 && query
      ? () => {
          const updated = { ...cached, index: (cached.index + 1) % cached.photos.length };
          write(query, updated);
          setState({ query, cached: updated });
        }
      : null;
  return { photo, next };
}
