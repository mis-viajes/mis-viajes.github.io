
import { Download, LayoutDashboard, Luggage, Menu, Plane, Search, Settings, X } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router";
import { useEffect, useState, type ReactNode } from "react";
import { promptInstall, useCanInstall } from "@/lib/install";
import { OfflineNotice } from "./offline-notice";
import { ThemeToggle } from "./theme-toggle";
import { cx } from "./ui";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/trips", label: "Mis viajes", icon: Luggage, exact: true },
  { href: "/buscar", label: "Buscar", icon: Search, exact: true },
  { href: "/ajustes", label: "Ajustes", icon: Settings, exact: true },
];

/** Enlaces principales con el activo resaltado. */
function NavLinks({ pathname }: { pathname: string }) {
  return NAV.map(({ href, label, icon: Icon, exact }) => {
    const active = exact ? pathname === href : pathname.startsWith(href);
    return (
      <Link
        key={href}
        to={href}
        className={cx(
          "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm",
          active ? "bg-accent-soft font-medium text-accent" : "text-muted hover:bg-surface-2 hover:text-ink",
        )}
      >
        <Icon size={17} />
        {label}
      </Link>
    );
  });
}

export function AppShell({ children, trips }: { children: ReactNode; trips: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  // Cierra el menú móvil al navegar.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setOpen(false), [pathname]);
  const canInstall = useCanInstall();
  const navigate = useNavigate();

  // Ctrl+K o Cmd+K abre la búsqueda desde cualquier pantalla.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        navigate("/buscar");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);

  const sidebar = (
    <nav className="flex h-full flex-col gap-1 p-3">
      <Link to="/" className="mb-4 flex items-center gap-2 px-2 pt-1 text-base font-semibold">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-accent-ink">
          <Plane size={17} />
        </span>
        Travel Manager
      </Link>
      <NavLinks pathname={pathname} />
      <p className="mt-5 px-2.5 text-xs font-medium uppercase tracking-wide text-muted">Viajes</p>
      <div className="min-h-0 flex-1 overflow-y-auto">{trips}</div>
      <div className="border-t border-line pt-2">
        {canInstall && (
          <button type="button" onClick={promptInstall} className="mb-1 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-accent hover:bg-accent-soft">
            <Download size={17} /> Instalar app
          </button>
        )}
        <ThemeToggle />
      </div>
    </nav>
  );

  return (
    <div className="flex min-h-dvh">

      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 border-r border-line bg-surface lg:block print:hidden">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-[1100] lg:hidden">
          <button type="button" className="absolute inset-0 bg-black/40" aria-label="Cerrar menú" onClick={() => setOpen(false)} />
          <aside className="relative h-full w-64 border-r border-line bg-surface shadow-xl">
            <button type="button" onClick={() => setOpen(false)} className="absolute right-2 top-3 rounded-md p-1.5 text-muted" aria-label="Cerrar menú">
              <X size={18} />
            </button>
            {sidebar}
          </aside>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-[1000] flex items-center gap-2 border-b border-line bg-surface/90 px-4 py-2.5 backdrop-blur lg:hidden print:hidden">
          <button type="button" onClick={() => setOpen(true)} className="rounded-md p-1.5 text-muted hover:bg-surface-2" aria-label="Abrir menú">
            <Menu size={20} />
          </button>
          <Link to="/" className="flex-1 font-semibold">
            Travel Manager
          </Link>
          <Link to="/buscar" className="rounded-md p-1.5 text-muted hover:bg-surface-2" aria-label="Buscar">
            <Search size={20} />
          </Link>
        </header>
        <OfflineNotice />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-5 sm:px-6 sm:py-7 print:max-w-none print:p-0">{children}</main>
      </div>
    </div>
  );
}
