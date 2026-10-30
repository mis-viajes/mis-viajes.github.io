import { AlertTriangle, Info, OctagonAlert } from "lucide-react";
import { Link } from "react-router";
import type { Alert } from "@/lib/domain/alerts";
import { cx } from "./ui";

const SECTION_PATH: Record<Alert["section"], string> = {
  flights: "flights",
  lodging: "lodging",
  transport: "transport",
  activities: "activities",
  finance: "finance",
  overview: "",
};

const STYLE = {
  danger: { icon: OctagonAlert, cls: "text-danger bg-danger-soft" },
  warning: { icon: AlertTriangle, cls: "text-warning bg-warning-soft" },
  info: { icon: Info, cls: "text-info bg-info-soft" },
};

export function AlertList({ alerts, tripId, tripName }: { alerts: Alert[]; tripId: string; tripName?: string }) {
  return (
    <ul className="space-y-2">
      {alerts.map((a) => {
        const { icon: Icon, cls } = STYLE[a.level];
        return (
          <li key={`${tripId}-${a.id}`}>
            <Link
              to={`/trips/${tripId}/${SECTION_PATH[a.section]}`}
              className="flex gap-3 rounded-lg border border-line bg-surface p-3 transition hover:border-accent/40"
            >
              <span className={cx("grid h-7 w-7 shrink-0 place-items-center rounded-full", cls)}>
                <Icon size={15} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium">{a.title}</span>
                {(a.detail || tripName) && (
                  <span className="block text-xs text-muted">
                    {tripName && <span className="font-medium">{tripName} · </span>}
                    {a.detail}
                  </span>
                )}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
