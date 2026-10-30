
import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

export function Modal({
  open,
  onClose,
  title,
  children,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
    // Si la ruta se oculta (navegación con Activity), cerramos el diálogo.
    return () => {
      if (dialog.open) dialog.close();
    };
  }, [open]);

  const width = size === "sm" ? "max-w-md" : size === "lg" ? "max-w-4xl" : "max-w-2xl";

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={onClose}
      className={`m-auto w-[calc(100%-1.5rem)] ${width} rounded-2xl border border-line bg-surface p-0 text-ink shadow-2xl`}
    >
      {open && (
        <div className="flex max-h-[85vh] flex-col">
          <div className="flex items-center justify-between border-b border-line px-5 py-3">
            <h2 className="text-base font-semibold">{title}</h2>
            <button type="button" onClick={onClose} className="rounded-md p-1 text-muted hover:bg-surface-2 hover:text-ink" aria-label="Cerrar">
              <X size={18} />
            </button>
          </div>
          <div className="overflow-y-auto px-5 py-4">{children}</div>
        </div>
      )}
    </dialog>
  );
}
