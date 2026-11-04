import { requireClient } from "@/lib/auth/session";
import { getAgency, getClient } from "@/lib/data/clients";
import { balance, listInvoices } from "@/lib/data/invoices";
import { formatDate, formatMoney, today } from "@/lib/format";
import { Card, CardTitle, PageHeader } from "@/components/ui";
import { InvoiceTable } from "@/components/features/InvoiceTable";

export const metadata = { title: "Billing" };

export default async function BillingPage() {
  const viewer = await requireClient();
  const [agency, client, invoices] = await Promise.all([getAgency(viewer), getClient(viewer), listInvoices(viewer)]);
  const now = today();
  const b = balance(invoices, now);

  return (
    <>
      <PageHeader title="Billing" subtitle="What you owe us, your plan and every invoice." />
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="flex flex-col gap-2 md:col-span-2">
          <span className="text-[13px] font-medium text-muted">Current balance</span>
          <span className="text-[36px] font-semibold tracking-tight">{formatMoney(b.owing)}</span>
          {b.owing === 0 ? (
            <span className="font-medium text-good">You’re all paid up. Thank you!</span>
          ) : b.overdueCount > 0 ? (
            <span className="font-medium text-warn">
              {formatMoney(b.overdue)} is past due ({b.overdueCount} invoice{b.overdueCount > 1 ? "s" : ""}).
              {b.nextDue && ` The rest is due ${formatDate(b.nextDue)}.`}
            </span>
          ) : (
            <span className="text-muted">{b.nextDue ? `Next payment due ${formatDate(b.nextDue)}` : "Due now"}</span>
          )}
          {b.owing > 0 && agency.paymentInstructions && (
            <p className="mt-2 rounded-lg bg-subtle px-3 py-2 text-[14px]">
              <strong>How to pay:</strong> {agency.paymentInstructions}
            </p>
          )}
        </Card>
        <Card className="flex flex-col gap-2">
          <span className="text-[13px] font-medium text-muted">Your plan</span>
          <span className="text-[20px] font-semibold">{client.planName ?? "—"}</span>
          {client.websiteUrl && <span className="text-muted">{client.websiteUrl.replace(/^https?:\/\//, "")}</span>}
          {b.paid > 0 && <span className="mt-auto text-[13px] text-muted">Paid to date: {formatMoney(b.paid)}</span>}
        </Card>
      </div>
      <div>
        <CardTitle>Invoices</CardTitle>
        <InvoiceTable invoices={invoices} today={now} />
      </div>
    </>
  );
}
