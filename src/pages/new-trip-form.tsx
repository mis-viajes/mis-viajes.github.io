import { RecordForm } from "@/components/record-form";
import type { FormState } from "@/lib/forms";

export function NewTripForm({ action, onCreated }: { action: (prev: FormState, fd: FormData) => Promise<FormState>; onCreated: (id: string) => void }) {
  return (
    <RecordForm
      entity="trip"
      action={action}
      context={{ baseCurrency: "CLP" }}
      submitLabel="Crear viaje"
      onDone={(state) => state.savedId && onCreated(state.savedId)}
      extraFields={
        <div className="space-y-1">
          <label htmlFor="ownerName" className="text-xs font-medium text-muted">
            Tu nombre (primer viajero)
          </label>
          <input id="ownerName" name="ownerName" className="field" placeholder="Opcional: podrás añadir más viajeros después" />
        </div>
      }
    />
  );
}
