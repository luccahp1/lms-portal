import Link from "next/link";
import { requireClient } from "@/lib/auth/session";
import { getAgency } from "@/lib/data/clients";
import { getLatestNote, listWorkLog } from "@/lib/data/updates";
import { listRequests } from "@/lib/data/requests";
import { listMessages } from "@/lib/data/messages";
import { listFiles } from "@/lib/data/files";
import { balance, listInvoices } from "@/lib/data/invoices";
import { listTodos } from "@/lib/data/todos";
import { getSiteStats } from "@/lib/data/stats";
import { listAiAnswers, listRankings } from "@/lib/data/rankings";
import { summarise } from "@/lib/reports";
import { formatDate, formatDateTime, formatMoney, formatMonthKey, requestStatusLabel, today } from "@/lib/format";
import { charts } from "@/lib/charts";
import { Change, Count, Delta, KitCard, KitHead, KitIcon, KitPill, KitTile, Svg, type PillTone } from "@/components/kit";
import { ButtonLink } from "@/components/ui";
import { MonthlyNote } from "@/components/features/MonthlyNote";
import { WorkLogList } from "@/components/features/WorkLogList";

// The same section cards LMS Dash shows on this client's Overview (app/static/client.js),
// without the team's buttons.

const REQUEST_PILL: Record<string, PillTone> = { received: "jay", in_progress: "warn", review: "violet", done: "good" };

function addDays(day: string, n: number) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function lastMonths(now: string, n = 6) {
  const [y, m] = now.split("-").map(Number);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(y!, m! - 1 - (n - 1 - i), 1));
    return { key: d.toISOString().slice(0, 7), label: d.toLocaleDateString("en-CA", { month: "short", timeZone: "UTC" }) };
  });
}

export default async function PortalOverview() {
  const viewer = await requireClient();
  const [agency, note, workLog, requests, messages, files, invoices, todos, stats, rankings, ai] = await Promise.all([
    getAgency(viewer),
    getLatestNote(viewer),
    listWorkLog(viewer, undefined, 6),
    listRequests(viewer),
    listMessages(viewer),
    listFiles(viewer),
    listInvoices(viewer),
    listTodos(viewer),
    getSiteStats(viewer),
    listRankings(viewer),
    listAiAnswers(viewer),
  ]);
  const now = today();
  const firstName = viewer.name.split(" ")[0];

  // Website, last 30 days against the 30 before.
  const cur = summarise(stats.rows, { start: addDays(now, -29), end: now });
  const prev = summarise(stats.rows, { start: addDays(now, -59), end: addDays(now, -30) });
  const hasPrev = Boolean(stats.since && stats.since <= addDays(now, -59));
  const pv = (n: number) => (hasPrev ? n : null);
  const dayLabels = cur.series.map((d, i) =>
    i === 0 || i === cur.series.length - 1 || i % 7 === (cur.series.length - 1) % 7
      ? new Date(`${d.day}T12:00:00Z`).toLocaleDateString("en-CA", { month: "short", day: "numeric", timeZone: "UTC" })
      : "",
  );

  // Rankings: the latest month we have.
  const months = [...new Set(rankings.flatMap((k) => k.history.map((h) => h.month)))].sort();
  const month = months.at(-1);
  const before = months.at(-2);
  const kws = rankings.map((k) => ({
    keyword: k.keyword,
    cur: k.history.find((h) => h.month === month)?.position,
    prev: k.history.find((h) => h.month === before)?.position,
  }));
  const onPageOne = kws.filter((k) => k.cur && k.cur <= 10).length;
  const top = kws.filter((k) => k.cur).sort((a, b) => a.cur! - b.cur!).slice(0, 5);

  // AI answers: share of questions each assistant names you in, latest month.
  const aiMonth = [...new Set(ai.flatMap((q) => q.answers.map((a) => a.month)))].sort().at(-1);
  const engines = [...new Set(ai.flatMap((q) => q.answers.map((a) => a.engine)))];
  const rings = engines
    .map((e) => {
      const got = ai.map((q) => q.answers.find((a) => a.month === aiMonth && a.engine === e)?.result).filter(Boolean);
      const named = got.filter((r) => r === "yes" || r === "cited").length;
      return got.length ? charts.ring((named / got.length) * 100, e, `${named}/${got.length}`) : "";
    })
    .filter(Boolean);

  const openTodos = todos.filter((t) => t.status !== "done");
  const doneTodos = todos.length - openTodos.length;
  const pendingFiles = files.filter((f) => f.approval === "pending").length;
  const toApprove = requests.filter((r) => r.status === "review").length;
  const open = requests.filter((r) => r.status !== "done");
  const owed = balance(invoices, now);
  const billMonths = lastMonths(now);
  const billed = billMonths.map((m) =>
    invoices.filter((i) => i.status !== "draft" && String(i.issuedOn).startsWith(m.key)).reduce((s, i) => s + i.amountCents / 100, 0),
  );
  const yourTurn = openTodos.length + pendingFiles + toApprove;

  return (
    <>
      <KitHead
        kicker={new Date(`${now}T12:00:00Z`).toLocaleDateString("en-CA", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" })}
        title={`Hi ${firstName}`}
        sub={yourTurn ? `Here’s how your website is doing, and ${yourTurn === 1 ? "one thing" : `${yourTurn} things`} we need from you.` : "Here’s how your website is doing. Nothing needs you right now."}
        actions={
          <>
            <ButtonLink href="/portal/messages" variant="secondary">
              Message us
            </ButtonLink>
            <ButtonLink href="/portal/requests/new">Ask us for something</ButtonLink>
          </>
        }
      />

      <div className="k-grid">
        <KitCard c="forest" icon="web" title="Your website" sub="last 30 days" span="k-s8" go="/portal/reports">
          {stats.connected ? (
            <>
              <div className="k-tiles">
                <KitTile label="Visits" delta={<Change cur={cur.visits} prev={pv(prev.visits)} />}>
                  <Count value={cur.visits} />
                </KitTile>
                <KitTile label="Leads" delta={<Change cur={cur.leads} prev={pv(prev.leads)} />}>
                  <Count value={cur.leads} />
                </KitTile>
                <KitTile label="Calls" delta={<Change cur={cur.calls} prev={pv(prev.calls)} />}>
                  <Count value={cur.calls} />
                </KitTile>
                <KitTile label="Quote requests" delta={<Change cur={cur.quotes} prev={pv(prev.quotes)} />}>
                  <Count value={cur.quotes} />
                </KitTile>
              </div>
              {cur.visits ? (
                <Svg html={charts.area(cur.series.map((d) => d.visits), { h: 150, labels: dayLabels, label: "Visits a day, last 30 days" })} />
              ) : (
                <p className="k-note">No visits counted in the last 30 days yet.</p>
              )}
            </>
          ) : (
            <p className="k-note">We’re connecting your website’s numbers. They show up here once the first visits are counted.</p>
          )}
        </KitCard>

        <KitCard
          c="violet"
          icon="rank"
          title="Google rankings"
          sub={rankings.length ? `${rankings.length} tracked ${rankings.length === 1 ? "search" : "searches"}${month ? ` · ${formatMonthKey(month)}` : ""}` : "being set up"}
          span="k-s4"
          go="/portal/rankings"
        >
          {rankings.length ? (
            <>
              <Svg
                html={charts.gauge(
                  (onPageOne / rankings.length) * 100,
                  "On page one",
                  `${charts.count(onPageOne, { tag: "tspan" })}<tspan class="of" dx="4">/${rankings.length}</tspan>`,
                )}
              />
              {top.length ? (
                <div>
                  {top.map((k) => {
                    const d = k.prev ? k.prev - k.cur! : null;
                    return (
                      <div className="k-rank" key={k.keyword}>
                        <span className="k-rank__q">{k.keyword}</span>
                        <span className="k-rank__pos">#{k.cur}</span>
                        <span className={`k-rank__mv k-${d === null ? "flat" : d > 0 ? "up" : d < 0 ? "down" : "flat"}`}>
                          {d === null ? "new" : d === 0 ? "same" : `${d > 0 ? "↗" : "↘"} ${Math.abs(d)}`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="k-note">Not in the first 3 pages yet. That usually takes a few months of steady work.</p>
              )}
            </>
          ) : (
            <p className="k-note">We’re choosing the searches to track for you. Rankings show up after the first check.</p>
          )}
        </KitCard>

        {ai.length > 0 && (
          <KitCard c="violet" icon="chat" title="AI answers" sub={`Does the assistant name you? ${ai.length} questions`} span="k-s6" go="/portal/rankings">
            {rings.length ? <Svg className="k-rings" html={rings.join("")} /> : <p className="k-note">The first check is coming up.</p>}
          </KitCard>
        )}

        <KitCard
          c="amber"
          icon="todo"
          title="Your to-dos"
          sub={todos.length ? `${doneTodos} of ${todos.length} done` : "nothing for you to do"}
          span="k-s6"
          go="/portal/todos"
        >
          {todos.length ? (
            <>
              <div>
                {[...openTodos, ...todos.filter((t) => t.status === "done")].slice(0, 4).map((t) => (
                  <div className="k-todo" key={t.id}>
                    <span className={`k-cb ${t.status === "done" ? "on" : ""}`}>{t.status === "done" && <KitIcon name="check" />}</span>
                    <div className="k-todo__m">
                      {t.status === "done" ? <s>{t.title}</s> : t.title}
                      <small>{t.status === "done" && t.doneAt ? `Done ${formatDate(t.doneAt)}` : t.dueOn ? `By ${formatDate(t.dueOn)}` : t.why}</small>
                    </div>
                  </div>
                ))}
              </div>
              <Svg html={charts.bars([{ label: "Progress", pct: (doneTodos / todos.length) * 100, note: `${doneTodos} of ${todos.length}` }])} />
            </>
          ) : (
            <p className="k-note">When we need something only you can do, it shows up here.</p>
          )}
        </KitCard>

        <KitCard c="jay" icon="req" title="Requests" sub={open.length ? `${open.length} open` : "nothing open"} span="k-s4" go="/portal/requests">
          {requests.length ? (
            <div className="k-rows">
              {requests.slice(0, 4).map((r) => (
                <Link className="k-row" key={r.id} href={`/portal/requests/${r.id}`}>
                  <span className="k-row__m">
                    <b>{r.title}</b>
                    <small>{formatDate(r.updatedAt)}</small>
                  </span>
                  <span className="k-row__r">
                    <KitPill tone={REQUEST_PILL[r.status]}>{requestStatusLabel[r.status].label}</KitPill>
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="k-note">Need a change on your site? Ask us and track it here.</p>
          )}
        </KitCard>

        <KitCard c="coral" icon="chat" title="Messages" sub={messages.length ? `${messages.length} message${messages.length === 1 ? "" : "s"}` : "no messages yet"} span="k-s4" go="/portal/messages">
          {messages.length ? (
            <div className="k-msgs">
              {messages.slice(-2).map((m) => (
                <div className={`k-msg ${m.authorId === viewer.userId ? "k-msg--me" : ""}`} key={m.id}>
                  <span className="k-msg__who">{(m.authorName || "?").slice(0, 1).toUpperCase()}</span>
                  <div className="k-msg__bub">
                    <small>
                      {m.authorId === viewer.userId ? "You" : m.authorName} · {formatDateTime(m.createdAt)}
                    </small>
                    {m.body.length > 140 ? `${m.body.slice(0, 140)}…` : m.body}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="k-note">Questions, ideas, anything. We usually answer the same day.</p>
          )}
        </KitCard>

        <KitCard c="forest" icon="bill" title="Billing" sub={owed.overdueCount ? `${formatMoney(owed.overdue)} past due` : "all in one place"} span="k-s4" go="/portal/billing">
          <div className="k-tiles">
            <KitTile
              label="Balance"
              delta={
                owed.overdueCount ? (
                  <Delta dir="down">past due</Delta>
                ) : owed.nextDue ? (
                  <span className="k-tile__d k-flat">Due {formatDate(owed.nextDue)}</span>
                ) : (
                  <span className="k-tile__d k-up">All paid up</span>
                )
              }
            >
              <Count value={owed.owing / 100} format="money" />
            </KitTile>
            <KitTile label="Paid">
              <Count value={owed.paid / 100} format="money" />
            </KitTile>
          </div>
          {billed.some(Boolean) ? (
            <Svg html={charts.vbars(billed, billMonths.map((m) => m.label), { hi: billed.length - 1 })} />
          ) : (
            <p className="k-note">Nothing billed in the last 6 months.</p>
          )}
        </KitCard>

        <div className="k-s12 k-reveal">
          <MonthlyNote note={note} agencyName={agency.name} />
        </div>

        <KitCard c="jay" icon="history" title="What we did for you" sub="Every update to your site, as it happens" span="k-s12">
          <WorkLogList entries={workLog} />
        </KitCard>
      </div>
    </>
  );
}
