import { requireAdmin } from "@/lib/auth/session";
import { listInvoices } from "@/lib/data/invoices";
import { getAgency } from "@/lib/data/clients";
import { setPaymentInstructionsAction } from "@/app/actions";
import { today } from "@/lib/format";
import { Button, Card, CardTitle, Field, Textarea } from "@/components/ui";
import { InvoiceTable } from "@/components/features/InvoiceTable";
import { InvoiceForm } from "./InvoiceForm";

export default async function ClientBilling({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireAdmin();
  const { id } = await params;
  const [invoices, agency] = await Promise.all([listInvoices(viewer, id), getAgency(viewer)]);
  return (
    <>
      <Card>
        <CardTitle>New invoice</CardTitle>
        <p className="mb-4 text-muted">Drafts are hidden from the client. Mark it sent when it should show up on their Billing page.</p>
        <InvoiceForm clientId={id} />
      </Card>
      <InvoiceTable invoices={invoices} admin today={today()} />
      <Card>
        <CardTitle>How clients pay</CardTitle>
        <form action={setPaymentInstructionsAction} className="flex max-w-xl flex-col gap-3">
          <Field label="Payment instructions" hint="Shown to every client on their Billing page when they owe something.">
            <Textarea name="text" maxLength={1000} defaultValue={agency.paymentInstructions} />
          </Field>
          <div>
            <Button type="submit" variant="secondary">Save</Button>
          </div>
        </form>
      </Card>
    </>
  );
}
