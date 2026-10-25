import { requireAdmin } from "@/lib/auth/session";
import { listRequests } from "@/lib/data/requests";
import { ButtonLink, Card } from "@/components/ui";
import { RequestList } from "@/components/features/RequestList";

export default async function ClientRequests({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireAdmin();
  const { id } = await params;
  const requests = await listRequests(viewer, id);
  return (
    <>
      <div className="flex justify-end">
        <ButtonLink href={`/admin/clients/${id}/requests/new`} variant="secondary">
          Log a request for them
        </ButtonLink>
      </div>
      <Card className="py-2">
        <RequestList rows={requests} basePath={`/admin/clients/${id}`} />
      </Card>
    </>
  );
}
