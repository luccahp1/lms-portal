"use client";

import { useActionState } from "react";
import { Button, Field, FormError, Input } from "@/components/ui";
import { setPasswordAction } from "../../actions";

export function SetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(setPasswordAction, undefined);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      <FormError message={state?.error} />
      <Field label="New password" hint="At least 10 characters.">
        <Input name="password" type="password" autoComplete="new-password" minLength={10} required />
      </Field>
      <Field label="Confirm password">
        <Input name="confirm" type="password" autoComplete="new-password" minLength={10} required />
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save password and continue"}
      </Button>
    </form>
  );
}
