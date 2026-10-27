import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/session";
import { getRequest } from "@/lib/data/requests";
import { orNotFound } from "@/lib/page";
import { RequestDetail } from "@/components/features/RequestDetail";

export default async function AdminRequest({ params }: { params: Promise<{ id: string; rid: string }> }) {
  const viewer = await requireAdmin();
  const { id, rid } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(rid)) notFound();
  const data = await orNotFound(getRequest(viewer, rid));
  if (data.request.clientId !== id) notFound();
  return <RequestDetail data={data} viewerRole="agency_admin" backHref={`/admin/clients/${id}/requests`} />;
}
