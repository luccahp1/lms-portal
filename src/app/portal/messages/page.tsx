import { requireClient } from "@/lib/auth/session";
import { getAgency } from "@/lib/data/clients";
import { listMessages } from "@/lib/data/messages";
import { PageHeader } from "@/components/ui";
import { MessageThread } from "@/components/features/MessageThread";

export const metadata = { title: "Messages" };

export default async function MessagesPage() {
  const viewer = await requireClient();
  const [agency, messages] = await Promise.all([getAgency(viewer), listMessages(viewer)]);
  return (
    <>
      <PageHeader title="Messages" subtitle={`Talk to your team at ${agency.name}.`} />
      <MessageThread messages={messages} viewerId={viewer.userId} />
    </>
  );
}
