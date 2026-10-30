import { Download, KeyRound, LogOut, Upload } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/auth";
import { buttonStyles, Card, PageHeader, SectionTitle } from "@/components/ui";
import { fetchAllBundles, fetchExchangeRates } from "@/lib/data";
import { getApiKey, setApiKey } from "@/lib/import/api-key";
import { importBackup } from "@/lib/import-json";

export default function AppSettings() {
  const { email, signOut } = useAuth();
  const [key, setKey] = useState(() => getApiKey() ?? "");
  const [saved, setSaved] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const hasKey = Boolean(getApiKey());
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<{ tone: "ok" | "error" | "info"; text: string } | null>(null);

  const importFile = async (file: File | undefined) => {
    if (!file) return;
    setImporting(true);
    setImportMsg({ tone: "info", text: "Leyendo archivo…" });
    try {
      const s = await importBackup(await file.text(), (text) => setImportMsg({ tone: "info", text }));
      setImportMsg({
        tone: "ok",
        text:
          `Importado: ${s.trips} ${s.trips === 1 ? "viaje" : "viajes"}, ${s.flights} vuelos, ${s.expenses} gastos y ${s.documents} documentos.` +
          (s.skippedDocuments ? ` ${s.skippedDocuments} documentos sin archivo adjunto no se importaron.` : ""),
      });
    } catch (e) {
      setImportMsg({ tone: "error", text: e instanceof Error ? e.message : "No se pudo importar el archivo." });
    } finally {
      setImporting(false);
    }
  };

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

      <section>
        <SectionTitle
          title="Importar viajes desde archivo"
          subtitle="Carga un archivo JSON de Travel Manager (una copia exportada o un viaje preparado). Se crean viajes nuevos; no se modifica ni borra nada existente."
        />
        <label className={`${buttonStyles.secondary} cursor-pointer ${importing ? "pointer-events-none opacity-50" : ""}`}>
          <Upload size={16} /> {importing ? "Importando…" : "Elegir archivo JSON"}
          <input
            type="file"
            accept="application/json,.json"
            className="sr-only"
            disabled={importing}
            onChange={(e) => {
              importFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
        {importMsg && (
          <p className={`mt-2 text-sm ${importMsg.tone === "ok" ? "text-success" : importMsg.tone === "error" ? "text-danger" : "text-muted"}`}>
            {importMsg.text}
          </p>
        )}
      </section>
    </div>
  );
}
