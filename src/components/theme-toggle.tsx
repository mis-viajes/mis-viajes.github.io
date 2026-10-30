
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  const toggle = () => {
    const dark = document.documentElement.classList.toggle("dark");
    try {
      localStorage.setItem("theme", dark ? "dark" : "light");
    } catch {
      // Sin almacenamiento disponible: el tema solo dura esta visita.
    }
  };
  return (
    <button
      type="button"
      onClick={toggle}
      className="inline-flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-muted hover:bg-surface-2 hover:text-ink"
      aria-label="Cambiar tema claro/oscuro"
    >
      <Sun size={16} className="hidden dark:block" />
      <Moon size={16} className="dark:hidden" />
      <span className="hidden dark:inline">Modo claro</span>
      <span className="dark:hidden">Modo oscuro</span>
    </button>
  );
}
