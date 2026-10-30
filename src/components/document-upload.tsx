
import { Upload } from "lucide-react";
import { useRef, useState } from "react";
import { DOCUMENT_TYPE } from "@/lib/labels";
import { uploadDocument } from "@/lib/storage";
import type { DocumentRow } from "@/lib/types";
import { Modal } from "./modal";
import { buttonStyles } from "./ui";

export function DocumentUpload({ tripId, links }: { tripId: string; links: { value: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const fd = new FormData(e.currentTarget);
      const file = fd.get("file");
      if (!(file instanceof File) || file.size === 0) throw new Error("Selecciona un archivo.");
      const linked = String(fd.get("linked") ?? "");
      const [linkedType, linkedId] = linked.includes(":") ? linked.split(":") : [null, null];
      await uploadDocument(tripId, file, {
        title: String(fd.get("title") ?? ""),
        type: String(fd.get("type") ?? "otro") as DocumentRow["type"],
        linkedType: linkedType as DocumentRow["linkedType"],
        linkedId,
      });
      formRef.current?.reset();
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo subir el archivo.");
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <button type="button" className={buttonStyles.primary} onClick={() => setOpen(true)}>
        <Upload size={16} /> Subir documento
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Subir documento">
        <form ref={formRef} onSubmit={submit} className="space-y-3">
          <div className="space-y-1">
            <label htmlFor="d-file" className="text-xs font-medium text-muted">Archivo (PDF, imagen o TXT, máx. 20 MB) <span className="text-danger">*</span></label>
            <input id="d-file" name="file" type="file" required accept="application/pdf,image/png,image/jpeg,image/webp,image/gif,text/plain" className="field" />
          </div>
          <div className="space-y-1">
            <label htmlFor="d-title" className="text-xs font-medium text-muted">Título</label>
            <input id="d-title" name="title" className="field" placeholder="Si lo dejas vacío se usa el nombre del archivo" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label htmlFor="d-type" className="text-xs font-medium text-muted">Tipo</label>
              <select id="d-type" name="type" className="field" defaultValue="otro">
                {Object.entries(DOCUMENT_TYPE).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor="d-linked" className="text-xs font-medium text-muted">Asociar a</label>
              <select id="d-linked" name="linked" className="field" defaultValue="">
                <option value="">Nada (documento general)</option>
                {links.map((l) => (
                  <option key={l.value} value={l.value}>{l.label}</option>
                ))}
              </select>
            </div>
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex justify-end">
            <button type="submit" className={buttonStyles.primary} disabled={pending}>
              {pending ? "Subiendo…" : "Subir"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
