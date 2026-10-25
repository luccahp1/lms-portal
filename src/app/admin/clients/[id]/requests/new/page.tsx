import { requireAdmin } from "@/lib/auth/session";
import { NewRequestForm } from "@/components/features/NewRequestForm";

export default async function AdminNewRequest({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  return <NewRequestForm clientId={id} cancelHref={`/admin/clients/${id}/requests`} />;
}
