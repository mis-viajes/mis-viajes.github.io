
import { Check } from "lucide-react";
import { useState, useTransition } from "react";
import { Modal } from "./modal";
import { buttonStyles } from "./ui";

/** Marca un gasto como pagado indicando quién lo pagó. */
export function MarkPaidButton({
  action,
  travelers,
  defaultPayer,
}: {
  action: (paidBy: string | null) => Promise<void>;
  travelers: { id: string; name: string }[];
  defaultPayer: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [payer, setPayer] = useState(defaultPayer ?? travelers[0]?.id ?? "");
  const [pending, startTransition] = useTransition();
  return (
    <>
      <button type="button" className={buttonStyles.ghost} onClick={() => setOpen(true)} title="Marcar como pagado">
        <Check size={15} /> Pagado
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Marcar como pagado" size="sm">
        {travelers.length > 0 ? (
          <div className="space-y-1">
            <label htmlFor="mp-payer" className="text-xs font-medium text-muted">
              ¿Quién lo pagó?
            </label>
            <select id="mp-payer" className="field" value={payer} onChange={(e) => setPayer(e.target.value)}>
              {travelers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <p className="text-sm text-muted">Se marcará como pagado sin indicar quién pagó.</p>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className={buttonStyles.secondary} onClick={() => setOpen(false)}>
            Cancelar
          </button>
          <button
            type="button"
            className={buttonStyles.primary}
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await action(payer || null);
                setOpen(false);
              })
            }
          >
            Confirmar
          </button>
        </div>
      </Modal>
    </>
  );
}
