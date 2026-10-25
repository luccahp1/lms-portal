"use client";

import { useActionState } from "react";
import { Button, Field, FormError, Input } from "@/components/ui";
import { signUpAction } from "../../actions";

export function SignUpForm({ joinCode }: { joinCode: string }) {
  const [state, action, pending] = useActionState(signUpAction, undefined);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="joinCode" value={joinCode} />
      <FormError message={state?.error} />
      <Field label="Your name">
        <Input name="name" autoComplete="name" maxLength={200} required />
      </Field>
      <Field label="Business name">
        <Input name="business" autoComplete="organization" maxLength={200} required />
      </Field>
      <Field label="Email">
        <Input name="email" type="email" autoComplete="email" required />
      </Field>
      <Field label="Password" hint="At least 10 characters.">
        <Input name="password" type="password" autoComplete="new-password" minLength={10} required />
      </Field>
      <Field label="Confirm password">
        <Input name="confirm" type="password" autoComplete="new-password" minLength={10} required />
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}
