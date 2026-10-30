import { useTrip } from "@/pages/trip/context";
import { ExternalLink, FileText, Image as ImageIcon } from "lucide-react";
import { deleteDocument } from "@/lib/api";
import { DeleteButton } from "@/components/delete-button";
import { DocumentUpload } from "@/components/document-upload";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { formatDate } from "@/lib/domain/dates";
import { DOCUMENT_TYPE, TRANSPORT_TYPE } from "@/lib/labels";

export default function DocumentsPage() {
  const { b, tripId } = useTrip();

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
        subtitle="Billetes, reservas, seguros, entradas y comprobantes del viaje. Los archivos se guardan en tu equipo, en la carpeta storage/."
        actions={<DocumentUpload tripId={tripId} links={links} />}
      />
      {b.documents.length === 0 ? (
        <EmptyState icon={<FileText size={32} />} title="Sin documentos">
          Sube PDFs o imágenes y asócialos a un vuelo, alojamiento, actividad o gasto. Los archivos importados también aparecen aquí.
        </EmptyState>
      ) : (
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
                <a href={`/api/trips/${tripId}/documents/${d.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-accent hover:underline">
                  Abrir <ExternalLink size={13} />
                </a>
                <DeleteButton itemName={d.title} warning="Se eliminará también el archivo guardado." action={deleteDocument.bind(null, tripId, d.id)} />
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
