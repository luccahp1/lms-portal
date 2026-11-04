import Link from "next/link";
import { requireClient } from "@/lib/auth/session";
import { getAgency } from "@/lib/data/clients";
import { getLatestNote, listWorkLog } from "@/lib/data/updates";
import { listRequests } from "@/lib/data/requests";
import { listMessages } from "@/lib/data/messages";
import { listFiles } from "@/lib/data/files";
import { balance, listInvoices } from "@/lib/data/invoices";
import { countOpenTodos } from "@/lib/data/todos";
import { getSiteStats } from "@/lib/data/stats";
import { change, reportPeriods, summarise } from "@/lib/reports";
import { formatDate, formatDateTime, formatMoney, today } from "@/lib/format";
import { Avatar, ButtonLink, Card, CardTitle, Empty } from "@/components/ui";
import { MonthlyNote } from "@/components/features/MonthlyNote";
import { RequestList } from "@/components/features/RequestList";
import { WorkLogList } from "@/components/features/WorkLogList";

export default async function PortalHome() {
  const viewer = await requireClient();
  const [agency, note, workLog, requests, messages, files, invoices, todoCount, stats] = await Promise.all([
    getAgency(viewer),
    getLatestNote(viewer),
    listWorkLog(viewer, undefined, 6),
    listRequests(viewer),
    listMessages(viewer),
    listFiles(viewer),
    listInvoices(viewer),
    countOpenTodos(viewer),
    getSiteStats(viewer),
  ]);
  const now = today();

  const open = requests.filter((r) => r.status !== "done");
  const waiting = requests.filter((r) => r.status === "review").length;
  const pendingFiles = files.filter((f) => f.approval === "pending").length;
  const owed = balance(invoices, now);
  const firstName = viewer.name.split(" ")[0];
  const { current, previous } = reportPeriods(now.slice(0, 7), now);
  const visits = summarise(stats.rows, current).visits;
  const visitsBefore = summarise(stats.rows, previous).visits;
  const visitChange = stats.since && previous.end >= stats.since ? change(visits, visitsBefore) : null;
  const yourTurn = todoCount + pendingFiles + waiting;

  const tiles = [
    {
      href: "/portal/reports",
      label: "Visitors this month",
      value: stats.connected ? String(visits) : "—",
      detail: !stats.connected
        ? "Analytics coming soon"
        : visitChange === null
          ? "See your monthly report"
          : `${visitChange > 0 ? "+" : ""}${visitChange}% vs the same days last month`,
      tone: visitChange !== null && visitChange > 0 ? "good" : "muted",
    },
    {
      href: todoCount ? "/portal/todos" : pendingFiles ? "/portal/files" : "/portal/requests",
      label: "Waiting on you",
      value: String(yourTurn),
      detail: yourTurn
        ? [todoCount && `${todoCount} to-do${todoCount > 1 ? "s" : ""}`, pendingFiles && `${pendingFiles} file${pendingFiles > 1 ? "s" : ""} to approve`, waiting && `${waiting} request${waiting > 1 ? "s" : ""} to approve`]
            .filter(Boolean)
            .join(", ")
        : "You’re all caught up",
      tone: yourTurn ? "warn" : "muted",
    },
    {
      href: "/portal/requests",
      label: "Open requests",
      value: String(open.length),
      detail: open.length ? "We’re on it" : "Need something? Send a request",
      tone: "muted",
    },
    {
      href: "/portal/billing",
      label: "Balance",
      value: formatMoney(owed.owing),
      detail: owed.overdueCount ? `${formatMoney(owed.overdue)} past due` : owed.nextDue ? `Due ${formatDate(owed.nextDue)}` : owed.owing ? "Due now" : "All paid up",
      tone: owed.overdueCount ? "warn" : "muted",
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((s) => (
          <Link key={s.label} href={s.href} className="flex flex-col gap-1.5 rounded-[14px] border border-line bg-surface p-5 hover:border-line-strong">
            <span className="text-[13px] font-medium text-muted">{s.label}</span>
            <span className="text-[26px] font-semibold tracking-tight">{s.value}</span>
            <span
              className={`text-[13px] ${s.tone === "warn" ? "font-medium text-warn" : s.tone === "good" ? "font-medium text-good" : "text-muted"}`}
            >
              {s.detail}
            </span>
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
