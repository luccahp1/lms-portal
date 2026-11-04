"use client";

import { useActionState } from "react";
import { createClientUserAction, setStatsSourceAction } from "@/app/actions";
import { Button, Field, FormError, Input } from "@/components/ui";
import { CopyLink } from "@/components/CopyLink";

export function StatsSourceForm({ clientId, statsUrl, hasToken }: { clientId: string; statsUrl: string; hasToken: boolean }) {
  const [state, action, pending] = useActionState(setStatsSourceAction, undefined);
  return (
    <form action={action} className="flex max-w-xl flex-col gap-4">
      <input type="hidden" name="clientId" value={clientId} />
      <FormError message={state?.error} />
      {state?.ok && <p className="text-[13px] text-good">Saved and fetched.</p>}
      <Field label="Stats URL" hint="The client site's https://<domain>/api/stats endpoint. Empty disconnects.">
        <Input name="statsUrl" type="url" maxLength={500} defaultValue={statsUrl} placeholder="https://example.ca/api/stats" />
      </Field>
      <Field label="Token" hint={hasToken ? "A token is saved. Leave empty to keep it." : "The site's STATS_TOKEN secret."}>
        <Input name="statsToken" type="password" maxLength={500} autoComplete="off" />
      </Field>
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Checking…" : "Save and fetch now"}
        </Button>
      </div>
    </form>
  );
}

export function AddLoginForm({ clientId }: { clientId: string }) {
  const [state, action, pending] = useActionState(createClientUserAction, undefined);
  if (state?.resetUrl) {
    return (
      <CopyLink
        url={state.resetUrl}
        label="Set-password link"
        note="Send this to them. They choose their own password with it. It works once and expires in 14 days."
      />
    );
  }
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="clientId" value={clientId} />
      <FormError message={state?.error} />
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <Field label="Email">
          <Input name="email" type="email" required maxLength={320} />
        </Field>
        <Field label="Name">
          <Input name="name" required maxLength={200} />
        </Field>
        <Button type="submit" disabled={pending}>
          Add login
        </Button>
      </div>
    </form>
  );
}
