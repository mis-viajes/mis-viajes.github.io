import { Database, TriangleAlert } from "lucide-react";
import { isMissingSchema } from "@/lib/db";
import { Card } from "@/components/ui";

export function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-4" aria-busy="true" aria-label="Cargando">
      <div className="h-8 w-56 rounded-lg bg-surface-2" />
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="h-24 rounded-xl bg-surface-2" />
        <div className="h-24 rounded-xl bg-surface-2" />
        <div className="h-24 rounded-xl bg-surface-2" />
      </div>
      <div className="h-64 rounded-xl bg-surface-2" />
    </div>
  );
}

/** Error al leer datos. Si faltan las tablas, explica cómo crearlas. */
export function DataError({ error }: { error: unknown }) {
  if (isMissingSchema(error)) {
    return (
      <Card className="mx-auto max-w-2xl p-6">
        <p className="flex items-center gap-2 text-lg font-semibold">
          <Database size={20} className="text-accent" /> Falta preparar la base de datos
        </p>
        <p className="mt-2 text-sm text-muted">
          Las tablas de Travel Manager todavía no existen en tu proyecto de Supabase. Solo hay que crearlas una vez:
        </p>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm">
          <li>Abre tu proyecto en supabase.com → <strong>SQL Editor</strong> → <strong>New query</strong>.</li>
          <li>
            Pega el contenido del archivo <code className="rounded bg-surface-2 px-1">supabase/schema.sql</code> del repositorio y pulsa <strong>Run</strong>.
          </li>
          <li>Vuelve aquí y recarga la página.</li>
        </ol>
        <p className="mt-3 text-xs text-muted">Crea tablas con prefijo tm_ y no modifica las de tus otras apps.</p>
      </Card>
    );
  }
  return (
    <Card className="mx-auto max-w-2xl p-6">
      <p className="flex items-center gap-2 font-semibold">
        <TriangleAlert size={18} className="text-danger" /> No se pudieron cargar los datos
      </p>
      <p className="mt-2 text-sm text-muted">{error instanceof Error ? error.message : "Error desconocido."} Revisa tu conexión y recarga la página.</p>
    </Card>
  );
}
