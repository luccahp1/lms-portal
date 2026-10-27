import Link from "next/link";
import { requireAdmin } from "@/lib/auth/session";
import { listClients } from "@/lib/data/clients";
import { listAgencyOpenRequests } from "@/lib/data/requests";
import { formatDate } from "@/lib/format";
import { ButtonLink, Card, Empty, PageHeader, Pill } from "@/components/ui";

export const metadata = { title: "Clients" };

export default async function AdminHome() {
  const viewer = await requireAdmin();
  const [clients, open] = await Promise.all([listClients(viewer), listAgencyOpenRequests(viewer)]);

  return (
    <>
      <PageHeader
        title="Clients"
        subtitle="Everyone you work with. Click a client to post updates, answer requests and send invoices."
        actions={<ButtonLink href="/admin/clients/new">New client</ButtonLink>}
      />
      <Card className="py-2">
        {clients.length === 0 && <Empty>No clients yet. Add your first one.</Empty>}
        <ul className="flex flex-col">
          {clients.map((c) => {
            const openCount = open.filter((r) => r.clientId === c.id).length;
            const newCount = open.filter((r) => r.clientId === c.id && r.status === "received").length;
            return (
              <li key={c.id} className="border-t border-subtle first:border-t-0">
                <Link href={`/admin/clients/${c.id}`} className="-mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-4 hover:bg-canvas">
                  <div className="flex min-w-0 flex-col leading-snug">
                    <span className="font-medium">{c.name}</span>
                    <span className="text-[13px] text-muted">
                      {[c.planName, c.websiteUrl, `Client since ${formatDate(c.createdAt)}`].filter(Boolean).join(" · ")}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    {newCount > 0 && <Pill tone="warn">{newCount} new</Pill>}
                    <Pill tone="neutral">{openCount} open</Pill>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </Card>
    </>
  );
}
