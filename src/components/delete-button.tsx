
import { Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { Modal } from "./modal";
import { buttonStyles, cx } from "./ui";

/** Botón de eliminar con confirmación obligatoria. */
export function DeleteButton({
  action,
  itemName,
  warning,
  label,
  className,
}: {
  action: () => Promise<void>;
  itemName: string;
  warning?: string;
  label?: string;
  /** Clases extra para el botón (p. ej. para colocarlo sobre una imagen). */
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cx(label ? buttonStyles.secondary : buttonStyles.icon, className)}
        aria-label={`Eliminar ${itemName}`}
        title="Eliminar"
      >
        <Trash2 size={16} />
        {label}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Confirmar eliminación" size="sm">
        <p className="text-sm">
          ¿Eliminar <strong>{itemName}</strong>? Esta acción no se puede deshacer.
        </p>
        {warning && <p className="mt-2 text-sm text-muted">{warning}</p>}
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className={buttonStyles.secondary} onClick={() => setOpen(false)}>
            Cancelar
          </button>
          <button
            type="button"
            className={buttonStyles.danger}
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                try {
                  await action();
                  setOpen(false);
                } catch (e) {
                  // redirect() lanza una excepción controlada por Next.js: la dejamos pasar.
                  if (e && typeof e === "object" && "digest" in e) throw e;
                  setError("No se pudo eliminar. Inténtalo de nuevo.");
                }
              })
            }
          >
            {pending ? "Eliminando…" : "Eliminar"}
          </button>
        </div>
      </Modal>
    </>
  );
}
