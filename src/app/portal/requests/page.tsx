import { requireClient } from "@/lib/auth/session";
import { listRequests } from "@/lib/data/requests";
import { ButtonLink, Card, PageHeader } from "@/components/ui";
import { RequestList } from "@/components/features/RequestList";

export const metadata = { title: "Requests" };

export default async function RequestsPage() {
  const viewer = await requireClient();
  const requests = await listRequests(viewer);
  return (
    <>
      <PageHeader
        title="Requests"
        subtitle="Ask for any change to your site and track it here."
        actions={<ButtonLink href="/portal/requests/new">New request</ButtonLink>}
      />
      <Card className="py-2">
        <RequestList rows={requests} basePath="/portal" />
      </Card>
    </>
  );
}
