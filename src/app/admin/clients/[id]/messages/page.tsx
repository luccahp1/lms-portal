import { requireAdmin } from "@/lib/auth/session";
import { listMessages } from "@/lib/data/messages";
import { MessageThread } from "@/components/features/MessageThread";

export default async function ClientMessages({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireAdmin();
  const { id } = await params;
  const messages = await listMessages(viewer, id);
  return <MessageThread messages={messages} viewerId={viewer.userId} clientId={id} />;
}
