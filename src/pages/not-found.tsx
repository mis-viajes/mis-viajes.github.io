import { ButtonLink, EmptyState } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg pt-10">
      <EmptyState title="No encontrado" action={<ButtonLink to="/">Volver al dashboard</ButtonLink>}>
        El viaje o la página que buscas no existe o fue eliminado.
      </EmptyState>
    </div>
  );
}
