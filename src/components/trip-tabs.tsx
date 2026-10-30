
import { Link } from "react-router";
import { useLocation } from "react-router";
import { cx } from "./ui";

const TABS = [
  { path: "", label: "Resumen" },
  { path: "/calendar", label: "Calendario" },
  { path: "/checklist", label: "Checklist" },
  { path: "/destinations", label: "Destinos" },
  { path: "/flights", label: "Vuelos y equipaje" },
  { path: "/lodging", label: "Alojamiento" },
  { path: "/transport", label: "Transporte" },
  { path: "/activities", label: "Actividades" },
  { path: "/restaurants", label: "Restaurantes" },
  { path: "/finance", label: "Finanzas" },
  { path: "/map", label: "Mapa" },
  { path: "/documents", label: "Documentos" },
  { path: "/import", label: "Importar" },
  { path: "/settings", label: "Ajustes" },
];

export function TripTabs({ tripId }: { tripId: string }) {
  const { pathname } = useLocation();
  const base = `/trips/${tripId}`;
  return (
    <nav className="-mx-4 overflow-x-auto print:hidden border-b border-line px-4 sm:mx-0 sm:px-0" aria-label="Secciones del viaje">
      <ul className="flex min-w-max gap-1">
        {TABS.map((t) => {
          const href = base + t.path;
          const active = t.path === "" ? pathname === base : pathname.startsWith(href);
          return (
            <li key={t.path}>
              <Link
                to={href}
                className={cx(
                  "block border-b-2 px-3 py-2 text-sm whitespace-nowrap transition",
                  active ? "border-accent font-medium text-accent" : "border-transparent text-muted hover:text-ink",
                )}
              >
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
