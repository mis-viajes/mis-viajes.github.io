import { useTrip } from "@/pages/trip/context";
import { CloudDownload, ExternalLink, FileText, Image as ImageIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { deleteDocument } from "@/lib/api";
import { DeleteButton } from "@/components/delete-button";
import { DocumentUpload } from "@/components/document-upload";
import { Badge, buttonStyles, Card, EmptyState, PageHeader } from "@/components/ui";
import { formatDate } from "@/lib/domain/dates";
import { DOCUMENT_TYPE, TRANSPORT_TYPE } from "@/lib/labels";
import { readFile, saveFile, savedFileKeys } from "@/lib/offline";
import { documentUrl, downloadDocument } from "@/lib/storage";
import type { DocumentRow } from "@/lib/types";

/** Entrega el archivo guardado en el dispositivo: el sistema lo abre con su visor. */
function deliverLocalFile(file: Blob, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(file);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 60000);
}

export default function DocumentsPage() {
  const { b, tripId } = useTrip();
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    savedFileKeys().then(setSaved).catch(() => {});
  }, []);

  const open = async (d: DocumentRow) => {
    setError(null);
    const local = saved.has(d.storageKey) ? await readFile(d.storageKey) : undefined;
    if (local && !navigator.onLine) return deliverLocalFile(local, d.fileName);
    // La pestaña se abre antes de esperar el enlace firmado: si no, el navegador la bloquea.
    const tab = window.open("", "_blank");
    try {
      const url = await documentUrl(d.storageKey);
      if (tab) tab.location.href = url;
      else window.location.assign(url);
    } catch {
      tab?.close();
      if (local) deliverLocalFile(local, d.fileName);
      else setError("No se pudo abrir el archivo. Sin conexión solo se abren los documentos guardados en este dispositivo.");
    }
  };

  const saveAll = async () => {
    setError(null);
    const missing = b.documents.filter((d) => !saved.has(d.storageKey));
    try {
      for (const [i, d] of missing.entries()) {
        setProgress(`Guardando ${i + 1} de ${missing.length}…`);
        await saveFile(d.storageKey, await downloadDocument(d.storageKey));
        setSaved((s) => new Set(s).add(d.storageKey));
      }
    } catch {
      setError("No se pudieron guardar todos los documentos. Revisa tu conexión e inténtalo de nuevo.");
    } finally {
      setProgress(null);
    }
  };

  const savedCount = b.documents.filter((d) => saved.has(d.storageKey)).length;

  const links = [
    ...b.flights.map((f) => ({ value: `flight:${f.id}`, label: `Vuelo ${[f.airline, f.flightNumber].filter(Boolean).join(" ")} ${f.originCode ?? ""}→${f.destinationCode ?? ""}` })),
    ...b.lodgings.map((l) => ({ value: `lodging:${l.id}`, label: `Alojamiento: ${l.name}` })),
    ...b.transports.map((t) => ({ value: `transport:${t.id}`, label: `${TRANSPORT_TYPE[t.type]}: ${t.origin ?? "?"} → ${t.destination ?? "?"}` })),
    ...b.activities.map((a) => ({ value: `activity:${a.id}`, label: `Actividad: ${a.name}` })),
    ...b.expenses.map((e) => ({ value: `expense:${e.id}`, label: `Gasto: ${e.description}` })),
  ];
  const linkLabel = (type: string | null, id: string | null) => links.find((l) => l.value === `${type}:${id}`)?.label ?? null;

  return (
    <div>
      <PageHeader
        title="Documentos"
        subtitle="Billetes, reservas, seguros, entradas y comprobantes del viaje, guardados en tu cuenta de forma privada."
        actions={<DocumentUpload tripId={tripId} links={links} />}
      />
      {b.documents.length === 0 ? (
        <EmptyState icon={<FileText size={32} />} title="Sin documentos">
          Sube PDFs o imágenes y asócialos a un vuelo, alojamiento, actividad o gasto. Los archivos importados también aparecen aquí.
        </EmptyState>
      ) : (
        <>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted">
            {savedCount === b.documents.length ? "Todos disponibles sin conexión en este dispositivo." : `${savedCount} de ${b.documents.length} disponibles sin conexión en este dispositivo.`}
          </p>
          {savedCount < b.documents.length && (
            <button type="button" className={buttonStyles.secondary} disabled={progress !== null} onClick={saveAll}>
              <CloudDownload size={16} /> {progress ?? "Guardar para usar sin conexión"}
            </button>
          )}
        </div>
        {error && <p className="mb-3 text-sm text-danger">{error}</p>}
        <Card className="divide-y divide-line">
          {b.documents.map((d) => {
            const Icon = d.mimeType.startsWith("image/") ? ImageIcon : FileText;
            const linked = linkLabel(d.linkedType, d.linkedId);
            return (
              <div key={d.id} className="flex items-center gap-3 px-4 py-3">
                <Icon size={20} className="shrink-0 text-muted" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{d.title}</p>
                  <p className="truncate text-xs text-muted">
                    {[DOCUMENT_TYPE[d.type], linked, `${(d.size / 1024).toFixed(0)} KB`, formatDate(d.createdAt.slice(0, 10))].filter(Boolean).join(" · ")}
                  </p>
                </div>
                {d.linkedType && !linked && <Badge tone="warning">Reserva eliminada</Badge>}
                {saved.has(d.storageKey) && <Badge tone="success">Sin conexión</Badge>}
                <button type="button" onClick={() => open(d)} className="inline-flex items-center gap-1 text-sm text-accent hover:underline">
                  Abrir <ExternalLink size={13} />
                </button>
                <DeleteButton itemName={d.title} warning="Se eliminará también el archivo guardado." action={deleteDocument.bind(null, tripId, d.id)} />
              </div>
            );
          })}
        </Card>
        </>
      )}
    </div>
  );
}
