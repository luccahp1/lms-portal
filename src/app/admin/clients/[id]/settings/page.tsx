import Link from "next/link";
import { requireAdmin } from "@/lib/auth/session";
import { getClient, listClientUsers } from "@/lib/data/clients";
import { removeClientUserAction, updateClientAction } from "@/app/actions";
import { formatDate } from "@/lib/format";
import { Button, Card, CardTitle, Field, Input } from "@/components/ui";
import { ResetLinkButton } from "./ResetLinkButton";

export default async function ClientSettings({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireAdmin();
  const { id } = await params;
  const [client, people] = await Promise.all([getClient(viewer, id), listClientUsers(viewer, id)]);

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
        <CardTitle>Who can log in</CardTitle>
        {people.length === 0 && (
          <p className="text-muted">
            Nobody yet. Send them your{" "}
            <Link href="/admin/signups" className="text-accent hover:underline">
              sign-up link
            </Link>
            , then approve them under Sign-ups.
          </p>
        )}
        <ul className="flex flex-col">
          {people.map((u) => (
            <li key={u.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-subtle py-3 first:border-t-0">
              <div className="flex flex-col leading-snug">
                <span className="font-medium">{u.name}</span>
                <span className="text-[13px] text-muted">
                  {u.email} · since {formatDate(u.createdAt)}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <ResetLinkButton userId={u.id} />
                <form action={removeClientUserAction}>
                  <input type="hidden" name="userId" value={u.id} />
                  <Button type="submit" variant="danger">
                    Remove access
                  </Button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
