
import { Pencil, Plus } from "lucide-react";
import { useState } from "react";
import type { EntityName } from "@/lib/entities";
import { ENTITIES } from "@/lib/entities";
import type { FormState } from "@/lib/forms";
import { Modal } from "./modal";
import { RecordForm, type FormContext } from "./record-form";
import { buttonStyles } from "./ui";

/** Botón que abre un formulario de creación o edición en un diálogo. */
export function RecordDialog({
  entity,
  action,
  initial,
  context,
  mode = "create",
  label,
  title,
  variant,
}: {
  entity: EntityName;
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  initial?: Record<string, unknown>;
  context: FormContext;
  mode?: "create" | "edit";
  label?: string;
  title?: string;
  variant?: keyof typeof buttonStyles;
}) {
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState(0);
  const noun = ENTITIES[entity].label;
  const heading = title ?? (mode === "create" ? `Agregar ${noun}` : `Editar ${noun}`);
  const style = variant ?? (mode === "create" ? "primary" : "icon");

  return (
    <>
      <button
        type="button"
        className={buttonStyles[style]}
        onClick={() => {
          setKey((k) => k + 1);
          setOpen(true);
        }}
        aria-label={heading}
        title={heading}
      >
        {mode === "create" ? <Plus size={16} /> : <Pencil size={15} />}
        {style !== "icon" && (label ?? heading)}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={heading} size="lg">
        <RecordForm key={key} entity={entity} action={action} initial={initial} context={context} onDone={() => setOpen(false)} />
      </Modal>
    </>
  );
}
