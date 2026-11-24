"use client";

import { AnimatePresence, motion } from "motion/react";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Bell, Check, Clock, Inbox, ListChecks, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { api, errorMessage, qs } from "@/settled/lib/api";
import { money, plural } from "@/settled/lib/format";
import { invalidate, useResource } from "@/settled/lib/hooks";
import type { ActivityEvent, Invoice, Summary } from "@/settled/lib/types";
import { Num, rise, stagger } from "@/settled/ui/motion";
import { useToast } from "@/settled/ui/toast";
import { Avatar, Button, ButtonLink, ErrorState, Sk } from "@/settled/ui/ui";
import { AgingBar, ExpectedBars, MonthlyChart } from "@/settled/parts/Charts";
import { Feed } from "@/settled/parts/Feed";
import { SUMMARY_KEY, useShell } from "@/settled/shell/Frame";

const ACTIVITY_KEY = "/portal/invoicing/api/activity?limit=20";

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

/** Sends a reminder for a customer's overdue invoices (or their oldest open one). */
async function remindCustomer(customerId: string): Promise<number> {
  const { invoices } = await api.get<{ invoices: Invoice[] }>("/portal/invoicing/api/invoices" + qs({ customerId, status: "open", limit: 50 }));
  const withBalance = invoices.filter((i) => i.balanceCents > 0 && i.status !== "incoming");
  const late = withBalance.filter((i) => i.status === "overdue");
  const targets = late.length ? late : withBalance.slice(-1);
  for (const i of targets) await api.post(`/portal/invoicing/api/invoices/${i.id}/remind`);
  return targets.length;
}

export default function Dashboard() {
  const { person } = useShell();
  const summary = useResource<Summary>(SUMMARY_KEY);
  const activity = useResource<{ events: ActivityEvent[] }>(ACTIVITY_KEY, { poll: 20_000 });
  const toast = useToast();
  const seen = useRef<Set<string> | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [reminding, setReminding] = useState<string | null>(null);
  const [reminded, setReminded] = useState<Set<string>>(new Set());

  // New events since the page opened: animate them in, and celebrate payments.
  useEffect(() => {
    const evs = activity.data?.events;
    if (!evs) return;
    if (!seen.current) {
      seen.current = new Set(evs.map((e) => e.id));
      return;
    }
    const added = evs.filter((e) => !seen.current!.has(e.id));
    if (!added.length) return;
    added.forEach((e) => seen.current!.add(e.id));
    setFresh((f) => new Set([...f, ...added.map((e) => e.id)]));
    invalidate(SUMMARY_KEY);
    const paid = added.find((e) => e.kind === "invoice.paid");
    if (paid) toast.good(paid.summary);
  }, [activity.data, toast]);

  const s = summary.data;
  const cur = s?.currency ?? "CAD";
  const first = person.split(" ")[0];
  const empty = s && s.openCount + s.draftCount === 0 && s.monthly.every((m) => m.cents === 0) && !s.needsReviewCount;

  const remind = async (cid: string, name: string) => {
    setReminding(cid);
    try {
      const n = await remindCustomer(cid);
      setReminded((r) => new Set(r).add(cid));
      toast.good(n ? `Reminder sent to ${name}` : `${name} has nothing to remind about`);
      invalidate(ACTIVITY_KEY);
    } catch (err) {
      toast.bad(errorMessage(err));
    } finally {
      setReminding(null);
    }
  };

  if (summary.error && !s) return <ErrorState message={summary.error} onRetry={summary.reload} />;

  const delta = s && s.paidLastMonthCents > 0 ? (s.paidThisMonthCents - s.paidLastMonthCents) / s.paidLastMonthCents : null;

  return (
    <motion.div variants={stagger(0.05)} initial="hidden" animate="show">
      <motion.header variants={rise} className="page-head">
        <div>
          <p className="faint small">{new Date().toLocaleDateString("en-CA", { weekday: "long", month: "long", day: "numeric" })}</p>
          <h1>
            {greeting()}
            {first ? `, ${first}` : ""}
          </h1>
        </div>
      </motion.header>

      <AnimatePresence>
        {s && s.needsReviewCount > 0 ? (
          <motion.div key="review" variants={rise} exit={{ opacity: 0, scale: 0.98 }} layout>
            <Link href="/portal/invoicing/inbox" className="review-card">
              <span className="review-ico">
                <Inbox />
              </span>
              <span className="grow">
                <span className="bold" style={{ display: "block" }}>
                  {plural(s.needsReviewCount, "payment")} could use a quick look
                </span>
                <span className="small muted">Settled has suggestions ready. One tap each and it learns for next time.</span>
              </span>
              <span className="btn btn-sm review-btn">
                Review <ArrowRight />
              </span>
            </Link>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {empty ? (
        <motion.section variants={rise} className="card welcome">
          <div className="welcome-art" aria-hidden>
            <Sparkles />
          </div>
          <div className="grow">
            <h2>Let&apos;s get you paid</h2>
            <p className="muted" style={{ marginTop: 6, maxWidth: 520 }}>
              Finish setup and send your first invoice. When they pay, it marks itself paid.
            </p>
            <div className="hstack wrap" style={{ marginTop: 16 }}>
              <ButtonLink href="/portal/invoicing/setup" variant="primary" icon={<ListChecks />}>
                Continue setup
              </ButtonLink>
            </div>
          </div>
        </motion.section>
      ) : null}

      <motion.section variants={rise} className="stats">
        <Stat label="Outstanding" loading={!s} foot={s ? plural(s.openCount, "open invoice") : ""}>
          {s ? <Num value={s.outstandingCents} currency={cur} /> : null}
        </Stat>
        <Stat label="Overdue" loading={!s} tone={s && s.overdueCents > 0 ? "bad" : undefined} foot={s ? (s.overdueCount ? plural(s.overdueCount, "invoice") + " past due" : "Nothing late") : ""}>
          {s ? <Num value={s.overdueCents} currency={cur} /> : null}
        </Stat>
        <Stat
          label="Paid this month"
          loading={!s}
          tone="good"
          foot={
            s ? (
              delta === null ? (
                plural(s.paidThisMonthCount, "payment")
              ) : (
                <span className={"delta " + (delta >= 0 ? "up" : "down")}>
                  {delta >= 0 ? <ArrowUpRight /> : <ArrowDownRight />}
                  {Math.abs(Math.round(delta * 100))}% vs last month
                </span>
              )
            ) : (
              ""
            )
          }
        >
          {s ? <Num value={s.paidThisMonthCents} currency={cur} /> : null}
        </Stat>
        <Stat label="Average days to get paid" loading={!s} foot={s?.onTimeRate != null ? `${Math.round(s.onTimeRate * 100)}% paid on time` : "Shows once invoices are paid"}>
          {s ? s.avgDaysToPay == null ? <span className="num">–</span> : <Num value={s.avgDaysToPay} format="decimal1" /> : null}
          {s?.avgDaysToPay != null ? <span className="stat-unit"> days</span> : null}
        </Stat>
      </motion.section>

      <div className="dash-grid">
        <div className="stack-lg">
          <motion.section variants={rise} className="card card-pad">
            <div className="card-head">
              <div>
                <h2 className="card-title">Money in</h2>
                <p className="card-sub">Last 12 months, every method</p>
              </div>
              {s && s.clearingCents > 0 ? (
                <span className="pill" data-s="incoming">
                  <span className="pill-dot" />
                  <span className="num">{money(s.clearingCents, cur)}</span> on its way
                </span>
              ) : null}
            </div>
            {s ? <MonthlyChart data={s.monthly} currency={cur} /> : <Sk h={200} />}
          </motion.section>

          <div className="two-up">
            <motion.section variants={rise} className="card card-pad">
              <div className="card-head">
                <div>
                  <h2 className="card-title">Who owes what, by age</h2>
                  <p className="card-sub">Days past due</p>
                </div>
              </div>
              {s ? <AgingBar aging={s.aging} currency={cur} /> : <Sk h={80} />}
            </motion.section>
            <motion.section variants={rise} className="card card-pad">
              <div className="card-head">
                <div>
                  <h2 className="card-title">Expected in</h2>
                  <p className="card-sub">By due date, next 5 weeks</p>
                </div>
              </div>
              {s ? <ExpectedBars expected={s.expected} currency={cur} /> : <Sk h={120} />}
            </motion.section>
          </div>

          <motion.section variants={rise} className="card">
            <div className="card-head card-pad" style={{ marginBottom: 0, paddingBottom: 8 }}>
              <div>
                <h2 className="card-title">Who owes the most</h2>
                <p className="card-sub">One tap sends a polite reminder</p>
              </div>
              <Link href="/portal/invoicing/customers" className="link small">
                All customers
              </Link>
            </div>
            {!s ? (
              <div style={{ padding: 16 }}>
                <Sk h={120} />
              </div>
            ) : s.topOwing.length === 0 ? (
              <p className="muted small" style={{ padding: "4px 24px 24px" }}>
                Nobody owes you anything right now. That is a good feeling.
              </p>
            ) : (
              <div className="list">
                {s.topOwing.map((t) => (
                  <div key={t.customerId} className="list-row">
                    <Avatar name={t.name} />
                    <Link href={"/portal/invoicing/customers/" + t.customerId} className="cell-main">
                      <span className="cell-title" style={{ display: "block" }}>
                        {t.name}
                      </span>
                      <span className={"cell-sub" + (t.oldestDaysLate > 0 ? " late-text" : "")} style={{ display: "block" }}>
                        {t.oldestDaysLate > 0 ? `Oldest is ${t.oldestDaysLate} days late` : "Not due yet"}
                      </span>
                    </Link>
                    <span className="cell-amount">{money(t.cents, cur)}</span>
                    <Button
                      size="sm"
                      variant={reminded.has(t.customerId) ? "ghost" : "default"}
                      busy={reminding === t.customerId}
                      disabled={reminded.has(t.customerId)}
                      onClick={() => remind(t.customerId, t.name)}
                      icon={reminded.has(t.customerId) ? <Check /> : <Bell />}
                      aria-label={`Remind ${t.name}`}
                    >
                      <span className="hide-sm">{reminded.has(t.customerId) ? "Sent" : "Remind"}</span>
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </motion.section>
        </div>

        <div className="stack-lg">
          <motion.section variants={rise} className="card card-pad auto-card">
            <div className="auto-head">
              <Sparkles />
              <h2 className="card-title">Settled did this for you</h2>
            </div>
            <p className="small auto-sub">Last 90 days, without you lifting a finger</p>
            <div className="auto-grid">
              <div>
                <span className="auto-num">{s ? <Num value={s.automation.autoMatched} format="int" /> : "–"}</span>
                <span className="tiny">payments matched by itself</span>
              </div>
              <div>
                <span className="auto-num">{s ? <Num value={s.automation.reminders} format="int" /> : "–"}</span>
                <span className="tiny">reminders sent</span>
              </div>
              <div>
                <span className="auto-num">{s ? <Num value={s.automation.hoursSaved} format="decimal1" /> : "–"}</span>
                <span className="tiny">hours saved</span>
              </div>
            </div>
          </motion.section>

          <motion.section variants={rise} className="card">
            <div className="card-head card-pad" style={{ marginBottom: 0, paddingBottom: 6 }}>
              <div>
                <h2 className="card-title">Activity</h2>
                <p className="card-sub live">
                  <span className="live-dot" aria-hidden /> Live
                </p>
              </div>
            </div>
            {activity.data ? (
              activity.data.events.length ? (
                <Feed events={activity.data.events} freshIds={fresh} />
              ) : (
                <p className="muted small" style={{ padding: "4px 24px 24px" }}>
                  <Clock style={{ display: "inline", width: 14, height: 14, verticalAlign: -2 }} /> What happens shows up here: invoices sent, opened, paid.
                </p>
              )
            ) : (
              <div className="stack-sm" style={{ padding: 20 }}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <div className="hstack" key={i} style={{ gap: 12 }}>
                    <Sk w={32} h={32} r={10} />
                    <Sk w={`${60 + i * 6}%`} h={12} />
                  </div>
                ))}
              </div>
            )}
          </motion.section>
        </div>
      </div>
    </motion.div>
  );
}

function Stat({ label, children, foot, loading, tone }: { label: string; children?: React.ReactNode; foot?: React.ReactNode; loading?: boolean; tone?: "good" | "bad" }) {
  return (
    <div className={"card stat" + (tone ? " stat-" + tone : "")}>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{loading ? <Sk w={120} h={30} /> : children}</span>
      <span className="stat-foot">{loading ? <Sk w={90} h={11} /> : foot}</span>
    </div>
  );
}
