import { requireClient } from "@/lib/auth/session";
import { getClient } from "@/lib/data/clients";
import { listInvoices } from "@/lib/data/invoices";
import { formatDate, formatMoney } from "@/lib/format";
import { Card, PageHeader } from "@/components/ui";
import { InvoiceTable } from "@/components/features/InvoiceTable";

export const metadata = { title: "Billing" };

export default async function BillingPage() {
  const viewer = await requireClient();
  const [client, invoices] = await Promise.all([getClient(viewer), listInvoices(viewer)]);
  const due = invoices.filter((i) => i.status === "sent").sort((a, b) => a.dueOn.localeCompare(b.dueOn));

  return (
    <>
      <PageHeader title="Billing" subtitle="Your plan and invoices." />
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="flex flex-col gap-2">
          <span className="text-[13px] font-medium text-muted">Your plan</span>
          <span className="text-[22px] font-semibold">{client.planName ?? "—"}</span>
          {client.websiteUrl && <span className="text-muted">{client.websiteUrl}</span>}
        </Card>
        <Card className="flex flex-col gap-2">
          <span className="text-[13px] font-medium text-muted">Amount due</span>
          <span className="text-[32px] font-semibold tracking-tight">
            {formatMoney(due.reduce((sum, i) => sum + i.amountCents, 0))}
          </span>
          <span className="text-muted">{due[0] ? `Next due ${formatDate(due[0].dueOn)}` : "You’re all paid up"}</span>
        </Card>
      </div>
      <InvoiceTable invoices={invoices} />
    </>
  );
}
