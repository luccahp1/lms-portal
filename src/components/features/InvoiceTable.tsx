import { setInvoiceStatusAction } from "@/app/actions";
import { formatDate, formatMoney, invoiceStatusLabel } from "@/lib/format";
import { Card, Empty, Pill } from "@/components/ui";
import type { InvoiceStatus } from "@/db/schema";

type Invoice = {
  id: string;
  number: string;
  description: string;
  amountCents: number;
  issuedOn: string;
  dueOn: string;
  status: InvoiceStatus;
};

const nextStatus: Partial<Record<InvoiceStatus, { to: InvoiceStatus; label: string }>> = {
  draft: { to: "sent", label: "Mark sent" },
  sent: { to: "paid", label: "Mark paid" },
};

export function InvoiceTable({ invoices, admin = false }: { invoices: Invoice[]; admin?: boolean }) {
  if (invoices.length === 0) {
    return (
      <Card>
        <Empty>No invoices yet.</Empty>
      </Card>
    );
  }
  return (
    <Card className="overflow-x-auto p-0">
      <table className="w-full min-w-[560px] border-collapse">
        <thead>
          <tr className="text-left text-xs tracking-wide text-muted uppercase">
            <th className="px-6 py-3.5 font-semibold">Invoice</th>
            <th className="px-3 py-3.5 font-semibold">Issued</th>
            <th className="px-3 py-3.5 font-semibold">Due</th>
            <th className="px-3 py-3.5 font-semibold">Amount</th>
            <th className="px-6 py-3.5 text-right font-semibold">Status</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((inv) => {
            const status = invoiceStatusLabel[inv.status];
            const next = admin ? nextStatus[inv.status] : undefined;
            return (
              <tr key={inv.id} className="border-t border-subtle">
                <td className="px-6 py-3.5">
                  <div className="font-medium">{inv.number}</div>
                  {inv.description && <div className="text-[13px] text-muted">{inv.description}</div>}
                </td>
                <td className="px-3 py-3.5 text-muted">{formatDate(inv.issuedOn)}</td>
                <td className="px-3 py-3.5 text-muted">{formatDate(inv.dueOn)}</td>
                <td className="px-3 py-3.5">{formatMoney(inv.amountCents)}</td>
                <td className="px-6 py-3.5 text-right">
                  <div className="flex items-center justify-end gap-3">
                    {next && (
                      <form action={setInvoiceStatusAction}>
                        <input type="hidden" name="invoiceId" value={inv.id} />
                        <input type="hidden" name="status" value={next.to} />
                        <button type="submit" className="cursor-pointer text-[13px] font-medium text-accent hover:underline">
                          {next.label}
                        </button>
                      </form>
                    )}
                    <Pill tone={status.tone}>{status.label}</Pill>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}
