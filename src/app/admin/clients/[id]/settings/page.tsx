import { requireAdmin } from "@/lib/auth/session";
import { getClient, listClientUsers } from "@/lib/data/clients";
import { updateClientAction } from "@/app/actions";
import { Button, Card, CardTitle, Field, Input, Pill } from "@/components/ui";
import { ReinviteButton } from "./ReinviteButton";

export default async function ClientSettings({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireAdmin();
  const { id } = await params;
  const [client, contacts] = await Promise.all([getClient(viewer, id), listClientUsers(viewer, id)]);

  return (
    <>
      <Card>
        <CardTitle>Business details</CardTitle>
        <form action={updateClientAction} className="flex max-w-xl flex-col gap-4">
          <input type="hidden" name="clientId" value={id} />
          <Field label="Business name">
            <Input name="name" required maxLength={200} defaultValue={client.name} />
          </Field>
          <Field label="Website">
            <Input name="websiteUrl" maxLength={500} defaultValue={client.websiteUrl ?? ""} />
          </Field>
          <Field label="Plan">
            <Input name="planName" maxLength={200} defaultValue={client.planName ?? ""} />
          </Field>
          <div>
            <Button type="submit">Save</Button>
          </div>
        </form>
      </Card>

      <Card>
        <CardTitle>Login</CardTitle>
        <ul className="flex flex-col">
          {contacts.map((u) => (
            <li key={u.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-subtle py-3 first:border-t-0">
              <div className="flex flex-col leading-snug">
                <span className="font-medium">{u.name}</span>
                <span className="text-[13px] text-muted">{u.email}</span>
              </div>
              <div className="flex items-center gap-3">
                <Pill tone={u.activated ? "good" : "warn"}>{u.activated ? "Active" : "Invite not accepted"}</Pill>
                <ReinviteButton userId={u.id} label={u.activated ? "Password reset link" : "New invite link"} />
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
