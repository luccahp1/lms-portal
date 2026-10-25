import Link from "next/link";
import { requireAdmin } from "@/lib/auth/session";
import { listClients } from "@/lib/data/clients";
import { listAgencyOpenRequests } from "@/lib/data/requests";
import { formatDateTime, requestStatusLabel } from "@/lib/format";
import { Card, Empty, PageHeader, Pill } from "@/components/ui";

export const metadata = { title: "Request inbox" };

export default async function RequestInbox() {
  const viewer = await requireAdmin();
  const [requests, clients] = await Promise.all([listAgencyOpenRequests(viewer), listClients(viewer)]);
  const clientName = new Map(clients.map((c) => [c.id, c.name]));

  return (
    <>
      <PageHeader title="Request inbox" subtitle="Every open request across all clients, most recent activity first." />
      <Card className="py-2">
        {requests.length === 0 && <Empty>No open requests. Nice.</Empty>}
        <ul className="flex flex-col">
          {requests.map((r) => {
            const status = requestStatusLabel[r.status];
            return (
              <li key={r.id} className="border-t border-subtle first:border-t-0">
                <Link
                  href={`/admin/clients/${r.clientId}/requests/${r.id}`}
                  className="-mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-4 hover:bg-canvas"
                >
                  <div className="flex min-w-0 flex-col leading-snug">
                    <span className="font-medium">{r.title}</span>
                    <span className="text-[13px] text-muted">
                      {clientName.get(r.clientId)} · updated {formatDateTime(r.updatedAt)}
                    </span>
                  </div>
                  <Pill tone={status.tone}>{status.label}</Pill>
                </Link>
              </li>
            );
          })}
        </ul>
      </Card>
    </>
  );
}
