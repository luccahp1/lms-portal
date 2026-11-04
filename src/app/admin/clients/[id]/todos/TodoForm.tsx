"use client";

import { useActionState, useEffect, useRef } from "react";
import { saveTodoAction } from "@/app/actions";
import type { ActionItem } from "@/db/schema";
import { Button, Field, FormError, Input, Textarea } from "@/components/ui";

/** New to-do, or edit an existing one when `todo` is given. */
export function TodoForm({ clientId, todo }: { clientId: string; todo?: ActionItem }) {
  const [state, action, pending] = useActionState(saveTodoAction, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok && !todo) ref.current?.reset();
  }, [state, todo]);

  return (
    <form ref={ref} action={action} className="flex flex-col gap-4">
      <input type="hidden" name="clientId" value={clientId} />
      {todo && <input type="hidden" name="todoId" value={todo.id} />}
      <FormError message={state?.error} />
      {state?.ok && todo && <p className="text-[13px] text-good">Saved.</p>}
      <div className="grid gap-4 sm:grid-cols-[1fr_180px_100px]">
        <Field label="What they need to do">
          <Input name="title" required maxLength={200} defaultValue={todo?.title} placeholder="Verify your Google Business Profile" />
        </Field>
        <Field label="Due (optional)">
          <Input name="dueOn" type="date" defaultValue={todo?.dueOn ?? ""} />
        </Field>
        <Field label="Order">
          <Input name="sort" type="number" min={0} max={1000} defaultValue={todo?.sort ?? 0} />
        </Field>
      </div>
      <Field label="Why it matters" hint="One or two sentences the client reads first.">
        <Textarea name="why" maxLength={2000} defaultValue={todo?.why} />
      </Field>
      <Field label="Steps" hint="One step per line. They show as a numbered list.">
        <Textarea name="steps" rows={6} maxLength={8000} defaultValue={todo?.steps} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-[1fr_220px]">
        <Field label="Link (optional)" hint="https:// only">
          <Input name="linkUrl" type="url" maxLength={500} defaultValue={todo?.linkUrl ?? ""} placeholder="https://business.google.com" />
        </Field>
        <Field label="Button text">
          <Input name="linkLabel" maxLength={60} defaultValue={todo?.linkLabel ?? ""} placeholder="Open Google" />
        </Field>
      </div>
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : todo ? "Save changes" : "Add to-do"}
        </Button>
      </div>
    </form>
  );
}
