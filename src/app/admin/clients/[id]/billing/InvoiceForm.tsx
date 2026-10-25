"use client";

import { useActionState, useEffect, useRef } from "react";
import { createInvoiceAction } from "@/app/actions";
import { Button, Field, FormError, Input, Select } from "@/components/ui";

export function InvoiceForm({ clientId }: { clientId: string }) {
  const [state, action, pending] = useActionState(createInvoiceAction, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);

  const today = new Date().toISOString().slice(0, 10);
  const inTwoWeeks = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);

  return (
    <form ref={ref} action={action} className="flex flex-col gap-4">
      <input type="hidden" name="clientId" value={clientId} />
      <FormError message={state?.error} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Invoice number">
          <Input name="number" required maxLength={50} placeholder="INV-0001" />
        </Field>
        <Field label="Amount (CAD)">
          <Input name="amount" type="number" min="0.01" step="0.01" required />
        </Field>
        <Field label="Status">
          <Select name="status" defaultValue="sent">
            <option value="draft">Draft (hidden)</option>
            <option value="sent">Sent (due)</option>
            <option value="paid">Paid</option>
          </Select>
        </Field>
        <Field label="Description">
          <Input name="description" maxLength={500} placeholder="e.g. Website Care, November" />
        </Field>
        <Field label="Issued">
          <Input name="issuedOn" type="date" required defaultValue={today} />
        </Field>
        <Field label="Due">
          <Input name="dueOn" type="date" required defaultValue={inTwoWeeks} />
        </Field>
      </div>
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Add invoice"}
        </Button>
      </div>
    </form>
  );
}
