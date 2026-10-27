"use client";

import { useActionState } from "react";
import { upsertNoteAction } from "@/app/actions";
import { Button, Field, Input, Textarea } from "@/components/ui";

export function NoteEditor({
  clientId,
  month,
  initial,
}: {
  clientId: string;
  month: string;
  initial: { wins: string; workingOn: string; nextMonth: string };
}) {
  const [state, action, pending] = useActionState(upsertNoteAction, undefined);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="clientId" value={clientId} />
      <div className="max-w-48">
        <Field label="Month">
          <Input name="month" type="month" defaultValue={month} required />
        </Field>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Done this month">
          <Textarea name="wins" rows={5} defaultValue={initial.wins} placeholder={"New services page went live\nContact form fixed on mobile"} />
        </Field>
        <Field label="Working on">
          <Textarea name="workingOn" rows={5} defaultValue={initial.workingOn} />
        </Field>
        <Field label="Next month">
          <Textarea name="nextMonth" rows={5} defaultValue={initial.nextMonth} />
        </Field>
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Publishing…" : "Publish update"}
        </Button>
        {state?.ok && !pending && <span className="text-good">Published.</span>}
      </div>
    </form>
  );
}
