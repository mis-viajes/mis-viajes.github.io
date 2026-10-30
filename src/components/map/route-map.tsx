import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect } from "react";
import { MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from "react-leaflet";
import type { TripBundle } from "@/lib/domain/types";
import { hasCoords } from "@/lib/domain/geo";

function numberIcon(n: number) {
  return L.divIcon({
    className: "",
    html: `<div style="width:26px;height:26px;border-radius:9999px;background:#0f766e;color:white;border:3px solid white;box-shadow:0 1px 4px rgba(0,0,0,.4);display:grid;place-items:center;font:600 12px system-ui">${n}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

function Fit({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 1) map.setView(points[0], 6);
    else if (points.length > 1) map.fitBounds(L.latLngBounds(points), { padding: [30, 30], maxZoom: 7 });
  }, [map, points]);
  return null;
}

/** Mapa compacto con la ruta del viaje: destinos numerados y vuelos en línea discontinua. */
export default function RouteMap({ bundle }: { bundle: TripBundle }) {
  const dests = bundle.destinations.filter(hasCoords);
  const flights = bundle.flights.filter(
    (f) => f.bookingStatus !== "cancelado" && f.originLat !== null && f.originLng !== null && f.destinationLat !== null && f.destinationLng !== null,
  );
  // Para encuadrar, solo los destinos (los vuelos intercontinentales alejarían demasiado el mapa).
  const points: [number, number][] = dests.map((d) => [d.lat!, d.lng!]);
  if (points.length === 0) return null;
  return (
    <MapContainer center={points[0]} zoom={5} scrollWheelZoom={false} className="h-full w-full" attributionControl>
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <Fit points={points} />
      {flights.map((f) => (
        <Polyline
          key={f.id}
          positions={[
            [f.originLat!, f.originLng!],
            [f.destinationLat!, f.destinationLng!],
          ]}
          pathOptions={{ color: "#2563eb", weight: 2, opacity: 0.55, dashArray: "6 6" }}
        >
          <Tooltip sticky>{[f.airline, f.flightNumber].filter(Boolean).join(" ")}</Tooltip>
        </Polyline>
      ))}
      <Polyline positions={points} pathOptions={{ color: "#0f766e", weight: 3, opacity: 0.8 }} />
      {dests.map((d, i) => (
        <Marker key={d.id} position={[d.lat!, d.lng!]} icon={numberIcon(i + 1)}>
          <Tooltip direction="top" offset={[0, -12]}>
            {d.city}
          </Tooltip>
        </Marker>
      ))}
    </MapContainer>
  );
}
