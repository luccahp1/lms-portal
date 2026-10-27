import { notFound } from "next/navigation";
import { requireClient } from "@/lib/auth/session";
import { getRequest } from "@/lib/data/requests";
import { orNotFound } from "@/lib/page";
import { RequestDetail } from "@/components/features/RequestDetail";

export default async function RequestPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireClient();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const data = await orNotFound(getRequest(viewer, id));
  return <RequestDetail data={data} viewerRole="client" backHref="/portal/requests" />;
}
