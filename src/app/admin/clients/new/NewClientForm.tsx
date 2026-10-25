"use client";

import { useActionState } from "react";
import { createClientAction } from "@/app/actions";
import { Button, Card, Field, FormError, Input } from "@/components/ui";

export function NewClientForm() {
  const [state, action, pending] = useActionState(createClientAction, undefined);
  return (
    <Card>
      <form action={action} className="flex max-w-xl flex-col gap-4">
        <FormError message={state?.error} />
        <Field label="Business name">
          <Input name="name" required maxLength={200} />
        </Field>
        <Field label="Website" hint="Optional">
          <Input name="websiteUrl" placeholder="https://" maxLength={500} />
        </Field>
        <Field label="Plan" hint="Optional, shown on their Billing page">
          <Input name="planName" placeholder="e.g. Website Care" maxLength={200} />
        </Field>
        <div>
          <Button type="submit" disabled={pending}>
            {pending ? "Creating…" : "Create client"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
