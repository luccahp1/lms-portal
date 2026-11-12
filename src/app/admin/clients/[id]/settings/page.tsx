import Link from "next/link";
import { requireAdmin } from "@/lib/auth/session";
import { getClient, listClientUsers } from "@/lib/data/clients";
import { removeClientUserAction, setClientDashboardAction, updateClientAction } from "@/app/actions";
import { formatDate } from "@/lib/format";
import { Button, buttonClass, Card, CardTitle, Field, Input } from "@/components/ui";
import { getSiteStats, getStatsSource } from "@/lib/data/stats";
import { formatDateTime } from "@/lib/format";
import { ResetLinkButton } from "./ResetLinkButton";
import { AddLoginForm, StatsSourceForm } from "./SettingsForms";

export default async function ClientSettings({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireAdmin();
  const { id } = await params;
  const [client, people, source, stats] = await Promise.all([
    getClient(viewer, id),
    listClientUsers(viewer, id),
    getStatsSource(viewer, id),
    getSiteStats(viewer, id),
  ]);

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
        <CardTitle>Job dashboard</CardTitle>
        <form action={setClientDashboardAction} className="flex max-w-xl flex-col gap-4">
          <input type="hidden" name="clientId" value={id} />
          <Field label="Dashboard address">
            <Input name="dashboardUrl" maxLength={500} placeholder="https://" defaultValue={client.dashboardUrl ?? ""} />
          </Field>
          <p className="text-[13px] text-muted">
            For clients who have their own job dashboard. Their portal shows an Open your dashboard button that
            goes here; they sign in there with their dashboard login. Leave empty to hide the button.
          </p>
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
                <a href={`/admin/clients/${id}/preview?user=${u.id}`} target="_blank" rel="noopener" className={buttonClass("secondary")}>
                  View as {u.name.split(" ")[0]}
                </a>
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
        <div className="mt-4 border-t border-subtle pt-4">
          <h3 className="mb-2 text-[14px] font-semibold">Add a login directly</h3>
          <p className="mb-3 text-[13px] text-muted">Skips the sign-up link: you get a one-time link where they set their own password.</p>
          <AddLoginForm clientId={id} />
        </div>
      </Card>

      <Card>
        <CardTitle>Website analytics</CardTitle>
        <p className="mb-4 text-[13px] text-muted">
          {source.statsUrl
            ? stats.error
              ? `Last fetch failed: ${stats.error}`
              : `Connected. ${stats.rows.length} counter rows${stats.fetchedAt ? `, fetched ${formatDateTime(stats.fetchedAt)}` : ""}. Refreshed hourly.`
            : "Not connected. See docs/analytics.md for setting up a client site."}
        </p>
        <StatsSourceForm clientId={id} statsUrl={source.statsUrl} hasToken={source.hasToken} />
      </Card>
    </>
  );
}
