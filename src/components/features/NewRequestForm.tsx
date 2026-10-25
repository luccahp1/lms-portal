import { createRequestAction } from "@/app/actions";
import { Button, ButtonLink, Card, Field, Input, Textarea } from "@/components/ui";

export function NewRequestForm({ clientId, cancelHref }: { clientId?: string; cancelHref: string }) {
  return (
    <Card>
      <form action={createRequestAction} className="flex flex-col gap-4">
        <h2 className="text-base font-semibold">What would you like changed?</h2>
        {clientId && <input type="hidden" name="clientId" value={clientId} />}
        <Field label="Short title">
          <Input name="title" placeholder="e.g. Update our holiday hours" maxLength={200} required />
        </Field>
        <Field label="Details" hint="Which page, what it should say, any photos to use. You can attach files under Files.">
          <Textarea name="details" rows={5} maxLength={5000} />
        </Field>
        <div className="flex justify-end gap-2">
          <ButtonLink href={cancelHref} variant="secondary">
            Cancel
          </ButtonLink>
          <Button type="submit">Send request</Button>
        </div>
      </form>
    </Card>
  );
}
