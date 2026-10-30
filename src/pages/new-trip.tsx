import { useNavigate } from "react-router";
import { saveEntity } from "@/lib/api";
import { Card, PageHeader } from "@/components/ui";
import { NewTripForm } from "./new-trip-form";

export default function NewTripPage() {
  const navigate = useNavigate();
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Nuevo viaje" subtitle="Podrás añadir destinos, reservas y gastos después." />
      <Card className="p-5">
        <NewTripForm action={saveEntity.bind(null, "trip", null, null, null)} onCreated={(id) => navigate(`/trips/${id}`)} />
      </Card>
    </div>
  );
}
