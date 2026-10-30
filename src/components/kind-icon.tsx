import { BedDouble, LogIn, LogOut, MapPin, Plane, Ticket, TrainFront, Utensils, type LucideIcon } from "lucide-react";
import { cx } from "./ui";

/** Color e icono por tipo de elemento; los mismos colores que el mapa. */
export const KINDS = {
  flight: { icon: Plane, color: "#2563eb", label: "Vuelo" },
  transport: { icon: TrainFront, color: "#0891b2", label: "Transporte" },
  lodging: { icon: BedDouble, color: "#7c3aed", label: "Alojamiento" },
  checkin: { icon: LogIn, color: "#7c3aed", label: "Check-in" },
  checkout: { icon: LogOut, color: "#7c3aed", label: "Check-out" },
  activity: { icon: Ticket, color: "#d97706", label: "Actividad" },
  restaurant: { icon: Utensils, color: "#dc2626", label: "Restaurante" },
  destination: { icon: MapPin, color: "#0f766e", label: "Destino" },
} satisfies Record<string, { icon: LucideIcon; color: string; label: string }>;

export type Kind = keyof typeof KINDS;

export function KindIcon({ kind, size = "md", className }: { kind: Kind; size?: "sm" | "md" | "lg"; className?: string }) {
  const { icon: Icon, color, label } = KINDS[kind];
  const box = size === "sm" ? "h-7 w-7" : size === "lg" ? "h-11 w-11" : "h-9 w-9";
  const px = size === "sm" ? 14 : size === "lg" ? 20 : 17;
  return (
    <span
      className={cx("grid shrink-0 place-items-center rounded-full text-white shadow-sm ring-4 ring-surface", box, className)}
      style={{ background: color }}
      title={label}
    >
      <Icon size={px} aria-hidden />
      <span className="sr-only">{label}</span>
    </span>
  );
}
