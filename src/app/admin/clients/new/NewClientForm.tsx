"use client";

import { useActionState } from "react";
import { createClientAction } from "@/app/actions";
import { Button, ButtonLink, Card, Field, FormError, Input } from "@/components/ui";
import { InviteLink } from "@/components/InviteLink";

export function NewClientForm() {
  const [state, action, pending] = useActionState(createClientAction, undefined);

  if (state?.inviteUrl) {
    return (
      <Card className="flex flex-col gap-4">
        <InviteLink url={state.inviteUrl} />
        <div>
          <ButtonLink href="/admin" variant="secondary">
            Back to clients
          </ButtonLink>
        </div>
      </Card>
    );
  }

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
        <hr className="border-line" />
        <Field label="Contact name">
          <Input name="contactName" required maxLength={200} />
        </Field>
        <Field label="Contact email" hint="This is what they’ll log in with.">
          <Input name="contactEmail" type="email" required />
        </Field>
        <div>
          <Button type="submit" disabled={pending}>
            {pending ? "Creating…" : "Create client and invite link"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
