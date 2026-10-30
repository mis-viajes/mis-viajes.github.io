import clsx from "clsx";
import { Link } from "react-router";
import type { ComponentProps, ReactNode } from "react";

export const cx = clsx;

const buttonBase =
  "inline-flex items-center justify-center gap-1.5 rounded-lg text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40";

export const buttonStyles = {
  primary: `${buttonBase} bg-accent text-accent-ink px-3.5 py-2 hover:opacity-90`,
  secondary: `${buttonBase} border border-line bg-surface px-3.5 py-2 text-ink hover:bg-surface-2`,
  ghost: `${buttonBase} px-2.5 py-1.5 text-muted hover:bg-surface-2 hover:text-ink`,
  danger: `${buttonBase} bg-danger text-white px-3.5 py-2 hover:opacity-90`,
  icon: `${buttonBase} h-8 w-8 text-muted hover:bg-surface-2 hover:text-ink`,
};

export function ButtonLink({
  variant = "secondary",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: keyof typeof buttonStyles }) {
  return <Link className={cx(buttonStyles[variant], className)} {...props} />;
}

export function Card({ className, children, ...props }: ComponentProps<"div">) {
  return (
    <div className={cx("rounded-xl border border-line bg-surface", className)} {...props}>
      {children}
    </div>
  );
}

export function SectionTitle({ title, action, subtitle }: { title: string; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
        {subtitle && <div className="mt-1 text-sm text-muted">{subtitle}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

const toneStyles = {
  neutral: "bg-surface-2 text-muted",
  accent: "bg-accent-soft text-accent",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
};

export type Tone = keyof typeof toneStyles;

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", toneStyles[tone], className)}>
      {children}
    </span>
  );
}

export const BOOKING_TONE: Record<string, Tone> = {
  idea: "neutral",
  estimado: "info",
  reservado: "warning",
  confirmado: "success",
  cancelado: "danger",
};

export const EXPENSE_TONE: Record<string, Tone> = {
  pagado: "success",
  parcial: "info",
  pendiente: "warning",
  previsto: "neutral",
};

export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <Card className="flex flex-col items-center px-6 py-10 text-center">
      {icon && <div className="mb-3 text-muted">{icon}</div>}
      <p className="font-medium">{title}</p>
      {children && <div className="mt-1 max-w-md text-sm text-muted">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </Card>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: Tone }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className={cx("mt-1 text-xl font-semibold tabular-nums", tone && tone !== "neutral" && toneStyles[tone].split(" ")[1])}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </Card>
  );
}

export function Detail({ label, children }: { label: string; children: ReactNode }) {
  if (children === null || children === undefined || children === "" || children === false) return null;
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="truncate text-sm">{children}</dd>
    </div>
  );
}

export function ProgressBar({ value, max, tone = "accent" }: { value: number; max: number; tone?: "accent" | "danger" | "warning" }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const color = tone === "danger" ? "bg-danger" : tone === "warning" ? "bg-warning" : "bg-accent";
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div className={cx("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
    </div>
  );
}
