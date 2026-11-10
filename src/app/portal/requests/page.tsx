import { requireClient } from "@/lib/auth/session";
import { listRequests } from "@/lib/data/requests";
import { getClient } from "@/lib/data/clients";
import { ButtonLink, Card, PageHeader } from "@/components/ui";
import { RequestList } from "@/components/features/RequestList";

export const metadata = { title: "Requests" };

export default async function RequestsPage() {
  const viewer = await requireClient();
  const [requests, client] = await Promise.all([listRequests(viewer), getClient(viewer)]);
  const hasSite = Boolean(client.reviewUrl || client.websiteUrl);
  return (
    <>
      <PageHeader
        title="Requests"
        subtitle={
          hasSite
            ? "Point at what you want changed on your website, or write to us. Either way you can follow it here."
            : "Ask for any change to your site and track it here."
        }
        actions={
          hasSite ? (
            <>
              <ButtonLink href="/portal/requests/new" variant="secondary">
                Write a request
              </ButtonLink>
              {/* A full page load: the review tool has its own layout. */}
              <a className="k-btn k-btn--pri" href="/review">
                Request website changes
              </a>
            </>
          ) : (
            <ButtonLink href="/portal/requests/new">New request</ButtonLink>
          )
        }
      />
      <Card className="py-2">
        <RequestList rows={requests} basePath="/portal" />
      </Card>
    </>
  );
}
