import Link from "next/link";
import { requireClient } from "@/lib/auth/session";
import { getSiteStats } from "@/lib/data/stats";
import { listAiAnswers, listRankings } from "@/lib/data/rankings";
import { listNotes } from "@/lib/data/updates";
import { change, reportMonths, reportPeriods, shiftMonth, summarise } from "@/lib/reports";
import { formatDate, formatDateTime, formatMonthKey, lines, today } from "@/lib/format";
import { Card, CardTitle, Empty, PageHeader, Pill } from "@/components/ui";
import { BarList, DailyChart, positionText, rankMove, StatTile } from "@/components/features/Results";

export const metadata = { title: "Monthly reports" };

const PAGE_NAMES: Record<string, string> = { "/": "Home page" };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const viewer = await requireClient();
  const now = today();
  const [stats, rankings, ai, notes] = await Promise.all([
    getSiteStats(viewer),
    listRankings(viewer),
    listAiAnswers(viewer),
    listNotes(viewer),
  ]);
  const months = reportMonths(stats.since, now);
  const asked = (await searchParams).month;
  const month = asked && months.includes(asked) ? asked : months[0]!;
  const { current, previous, partial } = reportPeriods(month, now);
  const cur = summarise(stats.rows, current);
  const prev = summarise(stats.rows, previous);
  const vs = partial ? `vs the same days last month` : `vs ${formatMonthKey(shiftMonth(month, -1))}`;
  const hasPrev = !stats.since || previous.end >= stats.since;
  const pct = (a: number, b: number) => (hasPrev ? change(a, b) : null);
  const note = notes.find((n) => n.month.slice(0, 7) === month);

  // Rankings: this month's position against last month's, falling back to the latest we have.
  const rankRows = rankings.map((k) => {
    const byMonth = new Map(k.history.map((h) => [h.month, h.position]));
    const latest = k.history.filter((h) => h.month <= month).at(-1);
    const curPos = byMonth.get(month) ?? latest?.position;
    const prevPos = byMonth.get(shiftMonth(month, -1));
    return { keyword: k.keyword, priority: k.priority, cur: curPos, asOf: latest?.month, move: rankMove(prevPos, byMonth.get(month)) };
  });
  const top3 = rankRows.filter((r) => r.cur && r.cur <= 3).length;
  const top10 = rankRows.filter((r) => r.cur && r.cur <= 10).length;

  const aiMonth = ai.flatMap((q) => q.answers).filter((a) => a.month <= month).map((a) => a.month).sort().at(-1);
  const aiChecks = aiMonth ? ai.flatMap((q) => q.answers.filter((a) => a.month === aiMonth)) : [];
  const aiNamed = aiChecks.filter((a) => a.result !== "no").length;

  return (
    <>
      <PageHeader
        title="Monthly reports"
        subtitle={`${formatMonthKey(month)}${partial ? " so far" : ""}: how your website and search results did.`}
        actions={
          <nav aria-label="Report month" className="flex flex-wrap gap-1.5">
            {months.slice(0, 6).map((m) => (
              <Link
                key={m}
                href={`/portal/reports?month=${m}`}
                aria-current={m === month ? "page" : undefined}
                className={`rounded-lg border px-3 py-1.5 text-[13px] font-medium ${
                  m === month ? "border-accent bg-accent text-white" : "border-line-strong bg-surface hover:bg-subtle"
                }`}
              >
                {formatMonthKey(m).replace(/ \d{4}$/, "")}
              </Link>
            ))}
          </nav>
        }
      />

      {!stats.connected && (
        <Card>
          <Empty>Website analytics aren’t connected yet. We’ll switch them on as soon as your site is live.</Empty>
        </Card>
      )}

      {stats.connected && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile label="Visitors" value={String(cur.visits)} change={pct(cur.visits, prev.visits)} changeLabel={vs} />
            <StatTile label="Pages viewed" value={String(cur.views)} change={pct(cur.views, prev.views)} changeLabel={vs} />
            <StatTile label="Leads" value={String(cur.leads)} change={pct(cur.leads, prev.leads)} changeLabel={vs} />
            <StatTile
              label="Visitors who got in touch"
              value={cur.visits ? `${((100 * cur.leads) / cur.visits).toFixed(1)}%` : "—"}
            />
          </div>

          <Card>
            <CardTitle>Visits per day</CardTitle>
            {cur.visits === 0 ? <Empty>No visits counted in this period yet.</Empty> : <DailyChart series={cur.series} />}
            <p className="mt-3 text-xs text-muted">
              Counted by your own website without cookies or personal data.
              {stats.fetchedAt && ` Updated ${formatDateTime(stats.fetchedAt)}, refreshed every hour.`}
              {stats.error && " The latest refresh didn’t go through; these are the last numbers we have."}
            </p>
          </Card>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardTitle>How people got in touch</CardTitle>
              <ul className="flex flex-col">
                {[
                  { label: "Phone calls (taps on your number)", n: cur.calls, p: prev.calls },
                  { label: "Quote requests", n: cur.quotes, p: prev.quotes },
                  { label: "Emails", n: cur.emails, p: prev.emails },
                  { label: "Taps on Get directions", n: cur.directions, p: prev.directions },
                ].map((r) => (
                  <li key={r.label} className="flex items-center justify-between gap-3 border-t border-subtle py-2.5 first:border-t-0">
                    <span>{r.label}</span>
                    <span className="font-semibold">{r.n}</span>
                  </li>
                ))}
              </ul>
              {cur.services.length > 0 && (
                <>
                  <h3 className="mt-4 mb-2 text-[13px] font-semibold text-muted">Quotes by service</h3>
                  <BarList rows={cur.services} unit="" />
                </>
              )}
            </Card>
            <Card>
              <CardTitle>Where visitors came from</CardTitle>
              {cur.channels.length === 0 ? (
                <Empty>Nothing yet.</Empty>
              ) : (
                <BarList rows={cur.channels.map((c) => ({ name: c.label, n: c.visits }))} unit="visits" />
              )}
            </Card>
            <Card>
              <CardTitle>Most viewed pages</CardTitle>
              {cur.pages.length === 0 ? (
                <Empty>Nothing yet.</Empty>
              ) : (
                <BarList rows={cur.pages.map((p) => ({ name: PAGE_NAMES[p.name] ?? p.name, n: p.n }))} unit="views" />
              )}
            </Card>
          </div>
        </>
      )}

      <Card>
        <CardTitle action={<Link href="/portal/rankings" className="font-medium text-accent hover:underline">Forecast</Link>}>
          Google rankings
        </CardTitle>
        {rankRows.length === 0 ? (
          <Empty>We’re setting up the searches we track for you.</Empty>
        ) : (
          <>
            <p className="mb-3 text-[14px] text-muted">
              {top3} of {rankRows.length} searches in the top 3, {top10} on the first page of Google.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] border-collapse text-[14px]">
                <thead>
                  <tr className="text-left text-xs tracking-wide text-muted uppercase">
                    <th className="py-2 pr-3 font-semibold">Search</th>
                    <th className="px-3 py-2 font-semibold">Position</th>
                    <th className="py-2 pl-3 text-right font-semibold">Since last month</th>
                  </tr>
                </thead>
                <tbody>
                  {rankRows.map((r) => (
                    <tr key={r.keyword} className="border-t border-subtle">
                      <td className="py-2.5 pr-3">{r.keyword}</td>
                      <td className="px-3 py-2.5 font-semibold whitespace-nowrap">
                        {positionText(r.cur)}
                        {r.asOf && r.asOf !== month && (
                          <span className="ml-1 text-xs font-normal text-muted">({formatMonthKey(r.asOf).replace(/ \d{4}$/, "")})</span>
                        )}
                      </td>
                      <td className="py-2.5 pl-3 text-right">{r.move ? <Pill tone={r.move.tone}>{r.move.text}</Pill> : <span className="text-muted">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>

      {aiChecks.length > 0 && (
        <Card>
          <CardTitle>AI assistants</CardTitle>
          <p className="text-[14px]">
            We asked ChatGPT, Google’s AI answers and others the questions your customers ask. In{" "}
            {formatMonthKey(aiMonth!)}, you were named in <strong>{aiNamed}</strong> of {aiChecks.length} answers.
          </p>
        </Card>
      )}

      {note && (
        <Card>
          <CardTitle>From us, {formatMonthKey(month)}</CardTitle>
          <div className="grid gap-5 md:grid-cols-3">
            {[
              { title: "Wins", body: note.wins },
              { title: "What we worked on", body: note.workingOn },
              { title: "Next month", body: note.nextMonth },
            ]
              .filter((s) => s.body)
              .map((s) => (
                <div key={s.title}>
                  <h3 className="mb-1.5 text-[13px] font-semibold text-muted">{s.title}</h3>
                  <ul className="list-disc pl-5 text-[14px]">
                    {lines(s.body).map((l) => (
                      <li key={l}>{l}</li>
                    ))}
                  </ul>
                </div>
              ))}
          </div>
        </Card>
      )}

      {stats.since && <p className="text-xs text-muted">Counting since {formatDate(stats.since)}.</p>}
    </>
  );
}
