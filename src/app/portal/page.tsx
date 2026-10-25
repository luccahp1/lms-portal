import Link from "next/link";
import { requireClient } from "@/lib/auth/session";
import { getAgency } from "@/lib/data/clients";
import { getLatestNote, listWorkLog } from "@/lib/data/updates";
import { listRequests } from "@/lib/data/requests";
import { listMessages } from "@/lib/data/messages";
import { listFiles } from "@/lib/data/files";
import { listInvoices } from "@/lib/data/invoices";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { Avatar, ButtonLink, Card, CardTitle, Empty } from "@/components/ui";
import { MonthlyNote } from "@/components/features/MonthlyNote";
import { RequestList } from "@/components/features/RequestList";
import { WorkLogList } from "@/components/features/WorkLogList";

export default async function PortalHome() {
  const viewer = await requireClient();
  const [agency, note, workLog, requests, messages, files, invoices] = await Promise.all([
    getAgency(viewer),
    getLatestNote(viewer),
    listWorkLog(viewer, undefined, 6),
    listRequests(viewer),
    listMessages(viewer),
    listFiles(viewer),
    listInvoices(viewer),
  ]);

  const open = requests.filter((r) => r.status !== "done");
  const waiting = requests.filter((r) => r.status === "review").length;
  const pendingFiles = files.filter((f) => f.approval === "pending").length;
  const nextInvoice = invoices.filter((i) => i.status === "sent").sort((a, b) => a.dueOn.localeCompare(b.dueOn))[0];
  const firstName = viewer.name.split(" ")[0];

  const stats = [
    {
      href: "/portal/requests",
      label: "Open requests",
      value: String(open.length),
      detail: waiting ? `${waiting} waiting for your approval` : "Nothing waiting on you",
      warn: waiting > 0,
    },
    {
      href: "/portal/files",
      label: "Files to approve",
      value: String(pendingFiles),
      detail: pendingFiles ? "Something is ready for you" : "You’re all caught up",
      warn: pendingFiles > 0,
    },
    {
      href: "/portal/billing",
      label: "Next invoice",
      value: nextInvoice ? formatMoney(nextInvoice.amountCents) : "—",
      detail: nextInvoice ? `Due ${formatDate(nextInvoice.dueOn)}` : "Nothing due",
      warn: false,
    },
  ];

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight">Welcome back, {firstName}</h1>
          <p className="mt-1 text-[15px] text-muted">Here’s what’s happening with your website.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/portal/messages" variant="secondary">
            Message us
          </ButtonLink>
          <ButtonLink href="/portal/requests/new">New request</ButtonLink>
        </div>
      </div>

      <MonthlyNote note={note} agencyName={agency.name} />

      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="flex flex-col gap-1.5 rounded-[14px] border border-line bg-surface p-5 hover:border-line-strong">
            <span className="text-[13px] font-medium text-muted">{s.label}</span>
            <span className="text-[26px] font-semibold tracking-tight">{s.value}</span>
            <span className={`text-[13px] ${s.warn ? "font-medium text-warn" : "text-muted"}`}>{s.detail}</span>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle action={<Link href="/portal/requests" className="font-medium text-accent hover:underline">View all</Link>}>
            Your requests
          </CardTitle>
          <RequestList rows={requests.slice(0, 4)} basePath="/portal" compact />
        </Card>
        <Card>
          <CardTitle action={<Link href="/portal/messages" className="font-medium text-accent hover:underline">Open chat</Link>}>
            Latest messages
          </CardTitle>
          {messages.length === 0 && <Empty>No messages yet.</Empty>}
          <ul className="flex flex-col">
            {messages.slice(-3).map((m) => (
              <li key={m.id} className="flex gap-3 border-t border-subtle py-2.5 first:border-t-0">
                <Avatar text={m.authorRole === "agency_admin" ? "★" : "You"} accent={m.authorRole === "agency_admin"} />
                <div className="flex min-w-0 flex-col leading-snug">
                  <span className="text-[13px] text-muted">
                    {m.authorId === viewer.userId ? "You" : m.authorName} · {formatDateTime(m.createdAt)}
                  </span>
                  <span className="line-clamp-2">{m.body}</span>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card>
        <div className="mb-2">
          <h2 className="text-base font-semibold">What we did for you</h2>
          <p className="text-[13px] text-muted">Every update to your site, as it happens</p>
        </div>
        <WorkLogList entries={workLog} />
      </Card>
    </>
  );
}
