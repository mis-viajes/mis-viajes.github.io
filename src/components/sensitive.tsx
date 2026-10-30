
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

/** Muestra un dato sensible (códigos de reserva, accesos) enmascarado hasta que el usuario lo revela. */
export function Sensitive({ value }: { value: string | null | undefined }) {
  const [shown, setShown] = useState(false);
  if (!value) return null;
  const masked = value.length <= 3 ? "•••" : `${"•".repeat(Math.min(6, value.length - 2))}${value.slice(-2)}`;
  return (
    <span className="inline-flex items-center gap-1">
      <span className="font-mono">{shown ? value : masked}</span>
      <button
        type="button"
        onClick={() => setShown((s) => !s)}
        className="rounded p-0.5 text-muted hover:text-ink"
        aria-label={shown ? "Ocultar" : "Mostrar"}
      >
        {shown ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </span>
  );
}
