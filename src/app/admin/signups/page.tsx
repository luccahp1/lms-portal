import { requireAdmin } from "@/lib/auth/session";
import { getAgency, listClients } from "@/lib/data/clients";
import { listPendingSignups } from "@/lib/data/signups";
import { approveSignupAction, rejectSignupAction } from "@/app/actions";
import { formatDateTime } from "@/lib/format";
import { Button, Card, CardTitle, Empty, PageHeader, Select } from "@/components/ui";
import { CopyLink } from "@/components/CopyLink";

export const metadata = { title: "Sign-ups" };

export default async function SignupsPage() {
  const viewer = await requireAdmin();
  const [agency, pending, clients] = await Promise.all([getAgency(viewer), listPendingSignups(viewer), listClients(viewer)]);
  const joinUrl = `${process.env.APP_URL || "http://localhost:3000"}/join/${agency.joinCode}`;

  return (
    <>
      <PageHeader title="Sign-ups" subtitle="Clients create their own account, then you connect it to their business." />

      <Card>
        <CardTitle>Your sign-up link</CardTitle>
        <p className="mb-3 text-muted">Send it to clients or put it behind a “Client login” button on your website.</p>
        <CopyLink url={joinUrl} label="Sign-up link" note="New accounts can’t see anything until you approve them below." />
      </Card>

      <Card>
        <CardTitle>Waiting for approval</CardTitle>
        {pending.length === 0 && <Empty>No one waiting.</Empty>}
        <ul className="flex flex-col">
          {pending.map((p) => (
            <li key={p.id} className="flex flex-col gap-3 border-t border-subtle py-4 first:border-t-0">
              <div className="flex flex-col leading-snug">
                <span className="font-medium">
                  {p.name} <span className="font-normal text-muted">· {p.business}</span>
                </span>
                <span className="text-[13px] text-muted">
                  {p.email} · signed up {formatDateTime(p.createdAt)}
                </span>
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <form action={approveSignupAction} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="userId" value={p.id} />
                  <input type="hidden" name="newClientName" value={p.business ?? p.name} />
                  <label className="flex flex-col gap-1 text-[13px] font-medium">
                    Connect to
                    <div className="w-72">
                      <Select name="target" defaultValue={matchClient(clients, p.business) ?? "new"}>
                        <option value="new">New client: {p.business ?? p.name}</option>
                        {clients.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </Select>
                    </div>
                  </label>
                  <Button type="submit">Approve</Button>
                </form>
                <form action={rejectSignupAction}>
                  <input type="hidden" name="userId" value={p.id} />
                  <Button type="submit" variant="danger">
                    Reject
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

/** Pre-select an existing client whose name matches what they typed. */
function matchClient(clients: { id: string; name: string }[], business: string | null) {
  if (!business) return undefined;
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  return clients.find((c) => norm(c.name) === norm(business))?.id;
}
