"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, CircleCheck, Hourglass, Landmark, MailSearch, MessageSquareQuote, ShieldAlert, ShieldCheck, Sparkles, X, XCircle } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { api, errorMessage, qs } from "@/settled/lib/api";
import { day, dueText, money, plural } from "@/settled/lib/format";
import { invalidate, setCached, useResource } from "@/settled/lib/hooks";
import type { Deposit, Invoice, ScanResult, SettingsOut, Suggestion } from "@/settled/lib/types";
import { CheckDraw, Num, ease, spring } from "@/settled/ui/motion";
import { useToast } from "@/settled/ui/toast";
import { Avatar, Button, Dialog, Empty, ErrorState, Field, PageHead, Sk, Tabs } from "@/settled/ui/ui";
import { CustomerPicker } from "@/settled/parts/CustomerPicker";
import { EtTrack } from "@/settled/parts/EtTrack";
import { SUMMARY_KEY } from "@/settled/shell/Frame";

type Tab = "review" | "waiting" | "done" | "failed";
const REVIEW_KEY = "/portal/invoicing/api/deposits?status=review";
const MATCHED_KEY = "/portal/invoicing/api/deposits?status=matched";
const FAILED_KEY = "/portal/invoicing/api/deposits?status=failed";

export default function InboxPage() {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("review");
  const review = useResource<{ deposits: Deposit[] }>(REVIEW_KEY, { poll: 15_000 });
  const matched = useResource<{ deposits: Deposit[] }>(MATCHED_KEY, { poll: 30_000 });
  const failed = useResource<{ deposits: Deposit[] }>(FAILED_KEY);
  const settings = useResource<SettingsOut>("/portal/invoicing/api/settings");
  const [scanning, setScanning] = useState(false);
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [picking, setPicking] = useState<Deposit | null>(null);
  const [leaving, setLeaving] = useState<Record<string, "confirm" | "dismiss">>({});

  const waiting = useMemo(() => (matched.data?.deposits ?? []).filter((d) => d.etStatus === "pending" || d.etStatus === "processing"), [matched.data]);
  const done = useMemo(() => (matched.data?.deposits ?? []).filter((d) => d.etStatus !== "pending" && d.etStatus !== "processing"), [matched.data]);
  const reviewList = review.data?.deposits ?? [];

  const after = () => invalidate(MATCHED_KEY, SUMMARY_KEY, "/portal/invoicing/api/invoices", "/portal/invoicing/api/activity", "/portal/invoicing/api/customers", "/portal/invoicing/api/payments");

  const removeLocal = (id: string, how: "confirm" | "dismiss") => {
    setLeaving((l) => ({ ...l, [id]: how }));
    setCached<{ deposits: Deposit[] }>(REVIEW_KEY, (p) => ({ deposits: (p?.deposits ?? []).filter((d) => d.id !== id) }));
    setCached<{ needsReviewCount: number }>(SUMMARY_KEY, (p) => (p ? { ...p, needsReviewCount: Math.max(0, p.needsReviewCount - 1) } : (p as never)));
  };

  const confirm = async (d: Deposit, body: { customerId?: string; invoiceIds?: string[] }, label: string) => {
    removeLocal(d.id, "confirm");
    try {
      await api.post(`/portal/invoicing/api/deposits/${d.id}/confirm`, body);
      toast.good(`${money(d.amountCents)} from ${d.payerName || "them"} put on ${label}. Settled will remember.`);
      after();
    } catch (e) {
      toast.bad(errorMessage(e));
      review.reload();
    }
  };

  const dismiss = async (d: Deposit) => {
    removeLocal(d.id, "dismiss");
    try {
      await api.post(`/portal/invoicing/api/deposits/${d.id}/dismiss`, { reason: "Not an invoice payment" });
      toast.info("Set aside. It won't count toward any invoice.");
      after();
    } catch (e) {
      toast.bad(errorMessage(e));
      review.reload();
    }
  };

  const checkNow = async () => {
    setScanning(true);
    setScan(null);
    setScanError(null);
    try {
      const r = await api.post<ScanResult>("/portal/invoicing/api/settings/mailbox/scan");
      setScan(r);
      invalidate(REVIEW_KEY, MATCHED_KEY, FAILED_KEY, SUMMARY_KEY, "/portal/invoicing/api/invoices", "/portal/invoicing/api/activity");
    } catch (e) {
      setScanError(errorMessage(e));
    } finally {
      setScanning(false);
    }
  };

  const mailbox = settings.data?.connected.mailbox;

  return (
    <>
      <PageHead
        title="Money in"
        sub={
          review.data ? (
            reviewList.length ? (
              <>
                <Num value={reviewList.length} format="int" countUp={false} /> {reviewList.length === 1 ? "payment needs" : "payments need"} a quick look
              </>
            ) : (
              "Everything that came in is accounted for"
            )
          ) : (
            " "
          )
        }
        actions={
          mailbox ? (
            <Button icon={<MailSearch />} busy={scanning} onClick={checkNow}>
              Check email now
            </Button>
          ) : null
        }
      />

      <AnimatePresence>
        {scan || scanError ? (
          <motion.div
            className={"notice " + (scanError ? "notice-danger" : "notice-good")}
            style={{ marginBottom: 16 }}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            role="status"
          >
            {scanError ? <XCircle /> : <CircleCheck />}
            <span className="grow">
              {scanError
                ? scanError
                : scan!.transfers === 0
                  ? `Checked ${plural(scan!.scanned, "email")}. Nothing new since last time.`
                  : `Found ${plural(scan!.transfers, "e-Transfer update")}: ${scan!.matched} matched by itself, ${scan!.review} need a look${scan!.failed ? `, ${scan!.failed} never arrived` : ""}.`}
            </span>
            <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={() => (setScan(null), setScanError(null))} aria-label="Dismiss">
              <X />
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div style={{ marginBottom: 18 }}>
        <Tabs
          id="inbox-tabs"
          label="Money in"
          value={tab}
          onChange={setTab}
          items={[
            { value: "review", label: "Needs a look", badge: reviewList.length || null },
            { value: "waiting", label: "On its way", badge: waiting.length || null },
            { value: "done", label: "Done" },
            { value: "failed", label: "Didn't arrive", badge: failed.data?.deposits.length || null },
          ]}
        />
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.2 }}>
          {tab === "review" ? (
            review.error && !review.data ? (
              <ErrorState message={review.error} onRetry={review.reload} />
            ) : !review.data ? (
              <CardsSkeleton />
            ) : (
              <div className="dep-list">
                <AnimatePresence mode="popLayout">
                  {reviewList.map((d) => (
                    <ReviewCard key={d.id} d={d} leaving={leaving[d.id]} onConfirm={confirm} onDismiss={dismiss} onPick={() => setPicking(d)} />
                  ))}
                </AnimatePresence>
                {reviewList.length === 0 ? <CaughtUp /> : null}
              </div>
            )
          ) : tab === "waiting" ? (
            <SimpleList data={matched.data ? waiting : undefined} empty={<Empty icon={<Hourglass />} title="Nothing on its way">When a customer sends an e-Transfer that hasn&apos;t landed yet, you&apos;ll see it here. The invoice shows Incoming and reminders wait.</Empty>} />
          ) : tab === "done" ? (
            <SimpleList data={matched.data ? done : undefined} empty={<Empty icon={<Sparkles />} title="Nothing matched yet">Payments Settled matches by itself land here, so you can see what it did.</Empty>} />
          ) : (
            <SimpleList data={failed.data?.deposits} empty={<Empty icon={<ShieldCheck />} title="Nothing went missing">If an e-Transfer is cancelled, declined or expires, it shows up here and the invoice goes back to unpaid.</Empty>} />
          )}
        </motion.div>
      </AnimatePresence>

      <PickDialog deposit={picking} onClose={() => setPicking(null)} onConfirm={confirm} />
    </>
  );
}

function ReviewCard({
  d,
  leaving,
  onConfirm,
  onDismiss,
  onPick,
}: {
  d: Deposit;
  leaving?: "confirm" | "dismiss";
  onConfirm: (d: Deposit, body: { customerId?: string; invoiceIds?: string[] }, label: string) => void;
  onDismiss: (d: Deposit) => void;
  onPick: () => void;
}) {
  const reduce = useReducedMotion();
  const [chosen, setChosen] = useState<number | null>(null);
  const top = d.suggestions.slice(0, 3);

  return (
    <motion.article
      layout
      className="card dep-card"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0, x: 0, rotate: 0 }}
      exit={
        reduce
          ? { opacity: 0 }
          : leaving === "dismiss"
            ? { opacity: 0, scale: 0.96, y: 10, transition: { duration: 0.22 } }
            : { opacity: 0, x: 220, y: -40, rotate: 6, scale: 0.92, transition: { duration: 0.42, ease } }
      }
      transition={spring}
    >
      {leaving === "confirm" ? <span className="dep-done-flash" aria-hidden /> : null}
      <header className="dep-head">
        <div className="grow">
          <div className="dep-amt num">{money(d.amountCents, d.currency)}</div>
          <div className="small">
            <span className="bold">{d.payerName || "Unknown sender"}</span>
            {d.payerEmail ? <span className="faint"> · {d.payerEmail}</span> : null}
          </div>
          <div className="tiny faint">
            {d.source === "bank_import" ? "From your bank statement" : "Interac e-Transfer"} · {day(d.receivedOn)}
            {d.reference ? <> · Ref {d.reference}</> : null}
          </div>
        </div>
        {d.source === "etransfer_email" ? (
          d.verified ? (
            <span className="verified" title={d.verifyNote}>
              <ShieldCheck /> Verified
            </span>
          ) : null
        ) : (
          <span className="verified neutral">
            <Landmark /> Bank line
          </span>
        )}
      </header>

      {d.source === "etransfer_email" && !d.verified ? (
        <div className="notice notice-warn" style={{ marginTop: 12 }}>
          <ShieldAlert />
          <span>
            <strong>Could not confirm this came from Interac.</strong> {d.verifyNote} Check your bank before you count it.
          </span>
        </div>
      ) : null}

      {d.memo ? (
        <blockquote className="dep-memo">
          <MessageSquareQuote />
          <span>{d.memo}</span>
        </blockquote>
      ) : null}

      {d.etStatus ? (
        <div style={{ marginTop: 14 }}>
          <EtTrack status={d.etStatus} />
        </div>
      ) : null}

      <div className="dep-sugs">
        <span className="label">{top.length ? "Is this for…" : "Settled couldn't find a likely match"}</span>
        {top.map((s, i) => (
          <SuggestionRow
            key={s.customerId + s.invoiceIds.join()}
            s={s}
            best={i === 0}
            busy={chosen === i}
            onClick={() => {
              setChosen(i);
              onConfirm(d, s.invoiceIds.length ? { customerId: s.customerId, invoiceIds: s.invoiceIds } : { customerId: s.customerId }, s.invoiceNumbers.length ? s.invoiceNumbers.join(", ") : s.customerName + "'s account");
            }}
          />
        ))}
      </div>

      <footer className="dep-foot">
        <Button size="sm" onClick={onPick}>
          Something else
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onDismiss(d)}>
          Not an invoice payment
        </Button>
      </footer>
    </motion.article>
  );
}

function SuggestionRow({ s, best, busy, onClick }: { s: Suggestion; best: boolean; busy: boolean; onClick: () => void }) {
  return (
    <button type="button" className={"sug" + (best && s.strong ? " best" : "")} onClick={onClick} disabled={busy} aria-label={`Confirm: ${s.customerName}${s.invoiceNumbers.length ? ", " + s.invoiceNumbers.join(", ") : ""}`}>
      <Avatar name={s.customerName} size="sm" />
      <span className="grow" style={{ minWidth: 0 }}>
        <span className="sug-title">
          {s.customerName}
          {s.invoiceNumbers.length ? <span className="faint"> · {s.invoiceNumbers.join(", ")}</span> : <span className="faint"> · keep as credit</span>}
        </span>
        <span className="sug-reasons">
          {s.reasons.map((r) => (
            <span key={r} className="reason">
              <Check /> {r}
            </span>
          ))}
        </span>
      </span>
      <span className="sug-go">{busy ? <CheckDraw size={16} /> : <Check />}</span>
    </button>
  );
}

function CaughtUp() {
  return (
    <motion.div className="caught" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ ...spring, delay: 0.42 }}>
      <div className="caught-art" aria-hidden>
        {Array.from({ length: 8 }).map((_, i) => (
          <motion.span
            key={i}
            className="caught-spark moves"
            style={{ rotate: i * 45, x: Math.sin((i * Math.PI) / 4) * 58, y: -Math.cos((i * Math.PI) / 4) * 58 }}
            initial={{ opacity: 0, scale: 0.3 }}
            animate={{ opacity: [0, 1, 0], scale: [0.3, 1, 1.1] }}
            transition={{ duration: 1.1, delay: 0.75 + i * 0.02, ease }}
          />
        ))}
        <span className="caught-check">
          <CheckDraw size={34} stroke={2.6} delay={0.6} />
        </span>
      </div>
      <h3>All caught up</h3>
      <p>Every payment that came in is on the right invoice. Settled will drop anything it isn&apos;t sure about here.</p>
      <Link href="/portal/invoicing" className="link small">
        Back to the dashboard
      </Link>
    </motion.div>
  );
}

function SimpleList({ data, empty }: { data: Deposit[] | undefined; empty: React.ReactNode }) {
  if (!data) return <CardsSkeleton />;
  if (!data.length) return <section className="card">{empty}</section>;
  return (
    <section className="card">
      <motion.ul className="list" initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.03 } } }}>
        {data.map((d) => (
          <motion.li key={d.id} variants={{ hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0 } }} className="list-row dep-row">
            <span className="ico" style={{ ["--ic" as string]: d.status === "failed" ? "var(--st-overdue)" : d.etStatus === "pending" || d.etStatus === "processing" ? "var(--st-incoming)" : "var(--st-paid)" }}>
              {d.status === "failed" ? <XCircle /> : d.etStatus === "pending" || d.etStatus === "processing" ? <Hourglass /> : <Check />}
            </span>
            <span className="cell-main">
              <span className="cell-title" style={{ display: "block" }}>
                {d.payerName || "Unknown sender"}
                {d.memo ? <span className="faint" style={{ fontWeight: 400 }}> · &ldquo;{d.memo}&rdquo;</span> : null}
              </span>
              <span className="cell-sub" style={{ display: "block" }}>
                {day(d.receivedOn)} · {d.source === "bank_import" ? "Bank statement" : "e-Transfer"}
                {d.verified ? " · verified" : ""}
              </span>
              {d.etStatus ? (
                <div style={{ marginTop: 10, maxWidth: 420 }}>
                  <EtTrack status={d.etStatus} />
                </div>
              ) : null}
            </span>
            <span className="cell-amount">{money(d.amountCents, d.currency)}</span>
          </motion.li>
        ))}
      </motion.ul>
    </section>
  );
}

function CardsSkeleton() {
  return (
    <div className="dep-list" aria-busy="true">
      {[0, 1].map((i) => (
        <div key={i} className="card dep-card stack-sm">
          <Sk w={140} h={30} />
          <Sk w={220} h={13} />
          <Sk h={54} r={12} style={{ marginTop: 12 }} />
          <Sk h={54} r={12} />
        </div>
      ))}
    </div>
  );
}

function PickDialog({ deposit, onClose, onConfirm }: { deposit: Deposit | null; onClose: () => void; onConfirm: (d: Deposit, body: { customerId?: string; invoiceIds?: string[] }, label: string) => void }) {
  const [customer, setCustomer] = useState<{ id: string; name: string; email: string } | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const open = useResource<{ invoices: Invoice[] }>(customer ? "/portal/invoicing/api/invoices" + qs({ customerId: customer.id, status: "open", limit: 50 }) : null);
  const close = () => {
    setCustomer(null);
    setPicked(new Set());
    onClose();
  };
  const sum = (open.data?.invoices ?? []).filter((i) => picked.has(i.id)).reduce((s, i) => s + i.balanceCents, 0);

  return (
    <Dialog
      open={!!deposit}
      onClose={close}
      title="Which customer is this?"
      description={deposit ? `${money(deposit.amountCents)} from ${deposit.payerName || "an unknown sender"}. Settled will remember this payer.` : ""}
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!customer}
            icon={<Check />}
            onClick={() => {
              if (!deposit || !customer) return;
              const ids = [...picked];
              onConfirm(deposit, ids.length ? { customerId: customer.id, invoiceIds: ids } : { customerId: customer.id }, ids.length ? plural(ids.length, "invoice") : customer.name + "'s account");
              close();
            }}
          >
            {picked.size ? `Put on ${plural(picked.size, "invoice")}` : "Keep as credit"}
          </Button>
        </>
      }
    >
      <div className="stack">
        <Field label="Customer">
          <CustomerPicker value={customer?.id ?? null} onChange={(c) => (setCustomer(c), setPicked(new Set()))} />
        </Field>
        {customer ? (
          <div className="field">
            <span className="label">Their open invoices</span>
            <div className="pick-list">
              {!open.data ? (
                <Sk h={40} />
              ) : open.data.invoices.length === 0 ? (
                <span className="hint">Nothing open. The money will be kept as credit for their next invoice.</span>
              ) : (
                open.data.invoices.map((i) => (
                  <label key={i.id} className="pick-row">
                    <input
                      type="checkbox"
                      className="check"
                      checked={picked.has(i.id)}
                      onChange={(e) => {
                        const n = new Set(picked);
                        if (e.target.checked) n.add(i.id);
                        else n.delete(i.id);
                        setPicked(n);
                      }}
                    />
                    <span className="grow">
                      <span className="bold">{i.number}</span> <span className="small faint">{dueText(i.dueOn, i.daysOverdue)}</span>
                    </span>
                    <span className="num small">{money(i.balanceCents)}</span>
                  </label>
                ))
              )}
            </div>
            {deposit && picked.size ? (
              <span className={"hint" + (sum === deposit.amountCents ? "" : "")}>
                {sum === deposit.amountCents ? "Exactly what they owe on those." : sum > deposit.amountCents ? `${money(sum - deposit.amountCents)} will still be owing.` : `${money(deposit.amountCents - sum)} left over becomes credit.`}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </Dialog>
  );
}
