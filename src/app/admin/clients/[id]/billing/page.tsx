import { requireAdmin } from "@/lib/auth/session";
import { listInvoices } from "@/lib/data/invoices";
import { Card, CardTitle } from "@/components/ui";
import { InvoiceTable } from "@/components/features/InvoiceTable";
import { InvoiceForm } from "./InvoiceForm";

export default async function ClientBilling({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireAdmin();
  const { id } = await params;
  const invoices = await listInvoices(viewer, id);
  return (
    <>
      <Card>
        <CardTitle>New invoice</CardTitle>
        <p className="mb-4 text-muted">Drafts are hidden from the client. Mark it sent when it should show up on their Billing page.</p>
        <InvoiceForm clientId={id} />
      </Card>
      <InvoiceTable invoices={invoices} admin />
    </>
  );
}
