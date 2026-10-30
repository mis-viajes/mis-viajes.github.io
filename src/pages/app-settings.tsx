import { Download, KeyRound, LogOut } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/auth";
import { buttonStyles, Card, PageHeader, SectionTitle } from "@/components/ui";
import { fetchAllBundles, fetchExchangeRates } from "@/lib/data";
import { getApiKey, setApiKey } from "@/lib/import/api-key";

export default function AppSettings() {
  const { email, signOut } = useAuth();
  const [key, setKey] = useState(() => getApiKey() ?? "");
  const [saved, setSaved] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const hasKey = Boolean(getApiKey());

  const exportAll = async () => {
    setExporting(true);
    try {
      const [bundles, rates] = await Promise.all([fetchAllBundles(), fetchExchangeRates()]);
      const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), version: 1, trips: bundles, exchangeRates: rates }, null, 2)], {
        type: "application/json",
      });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `travel-manager-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <PageHeader title="Ajustes de la app" />

      <section>
        <SectionTitle title="Cuenta" />
        <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
          <p className="text-sm">
            Sesión iniciada como <strong>{email ?? "—"}</strong>
            <span className="block text-xs text-muted">La misma cuenta de Supabase que Mi Día, Finanzas y Kratos.</span>
          </p>
          <button type="button" className={buttonStyles.secondary} onClick={() => signOut()}>
            <LogOut size={16} /> Cerrar sesión
          </button>
        </Card>
      </section>

      <section>
        <SectionTitle
          title="Importación inteligente"
          subtitle="Clave de la API de Claude (Anthropic) para extraer datos de PDFs y capturas."
        />
        <Card className="space-y-3 p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setApiKey(key || null);
              setSaved(key ? "Clave guardada en este dispositivo." : "Clave eliminada de este dispositivo.");
            }}
            className="space-y-3"
          >
            <label htmlFor="api-key" className="flex items-center gap-1.5 text-xs font-medium text-muted">
              <KeyRound size={14} /> Clave de API {hasKey && <span className="text-success">· configurada</span>}
            </label>
            <input
              id="api-key"
              type="password"
              autoComplete="off"
              className="field font-mono"
              placeholder="sk-ant-…"
              value={key}
              onChange={(e) => setKey(e.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <button type="submit" className={buttonStyles.primary}>
                Guardar
              </button>
              {hasKey && (
                <button
                  type="button"
                  className={buttonStyles.secondary}
                  onClick={() => {
                    setApiKey(null);
                    setKey("");
                    setSaved("Clave eliminada de este dispositivo.");
                  }}
                >
                  Eliminar clave
                </button>
              )}
            </div>
          </form>
          {saved && <p className="text-sm text-success">{saved}</p>}
          <p className="text-xs text-muted">
            La clave se guarda solo en este navegador (no en la base de datos ni en GitHub) y los documentos se envían directamente de tu
            navegador a Anthropic. Cada importación tiene un costo de uso. Obtén una clave en console.anthropic.com; puedes fijarle un límite de
            gasto allí. Tendrás que añadirla en cada dispositivo donde quieras importar.
          </p>
        </Card>
      </section>

      <section>
        <SectionTitle title="Copia de seguridad" subtitle="Descarga todos tus viajes, reservas y gastos en un archivo JSON." />
        <button type="button" className={buttonStyles.secondary} onClick={exportAll} disabled={exporting}>
          <Download size={16} /> {exporting ? "Preparando…" : "Exportar mis datos"}
        </button>
        <p className="mt-2 text-xs text-muted">Los archivos adjuntos (PDFs, imágenes) quedan en Supabase Storage y no se incluyen.</p>
      </section>
    </div>
  );
}
