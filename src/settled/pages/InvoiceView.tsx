"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowLeft, Ban, Bell, CircleDollarSign, CopyPlus, Download, Ellipsis, ExternalLink, Eye, FilePen, Mail, Send, Trash2, Hourglass,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, use, useEffect, useRef, useState } from "react";
import { api, errorMessage } from "@/settled/lib/api";
import { dateTime, day, dueText, money } from "@/settled/lib/format";
import { invalidate, useResource } from "@/settled/lib/hooks";
import type { Invoice, InvoiceDetail, SendResult, SettingsOut } from "@/settled/lib/types";
import { InvoiceDoc } from "@/settled/ui/InvoiceDoc";
import { CheckDraw, Num, ease, rise, spring, stagger } from "@/settled/ui/motion";
import { useToast } from "@/settled/ui/toast";
import { Button, CopyField, Dialog, ErrorState, Field, Menu, Sk, StatusPill } from "@/settled/ui/ui";
import { Feed } from "@/settled/parts/Feed";
import { MethodIcon } from "@/settled/parts/MethodIcon";
import { RecordPayment } from "@/settled/parts/RecordPayment";
import { SUMMARY_KEY } from "@/settled/shell/Frame";

function Detail({ id }: { id: string }) {
  const key = "/portal/invoicing/api/invoices/" + id;
  const params = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const reduce = useReducedMotion();
  const res = useResource<InvoiceDetail>(key, { poll: 8_000 });
  const settings = useResource<SettingsOut>("/portal/invoicing/api/settings");
  const [recordOpen, setRecordOpen] = useState(false);
  const [remindOpen, setRemindOpen] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);
  const [remindMsg, setRemindMsg] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [paidMoment, setPaidMoment] = useState(false);
  const [justSent, setJustSent] = useState(params.get("sent") === "1");
  const prevStatus = useRef<string | null>(null);

  const d = res.data;
  const inv = d?.invoice;

  // The Paid moment: when this invoice turns paid while it is on screen.
  useEffect(() => {
    if (!inv) return;
    if (prevStatus.current && prevStatus.current !== "paid" && inv.status === "paid") {
      setPaidMoment(true);
      invalidate(SUMMARY_KEY, "/portal/invoicing/api/invoices?", "/portal/invoicing/api/activity");
      const t = setTimeout(() => setPaidMoment(false), 2400);
      prevStatus.current = inv.status;
      return () => clearTimeout(t);
    }
    prevStatus.current = inv.status;
  }, [inv]);

  useEffect(() => {
    if (!justSent) return;
    router.replace("/portal/invoicing/invoices/" + id, { scroll: false });
    const t = setTimeout(() => setJustSent(false), 4000);
    return () => clearTimeout(t);
  }, [justSent, id, router]);

  const refresh = () => {
    res.reload();
    invalidate("/portal/invoicing/api/invoices?", "/portal/invoicing/api/activity", SUMMARY_KEY, "/portal/invoicing/api/customers", "/portal/invoicing/api/payments");
  };

  const run = async (name: string, fn: () => Promise<unknown>, ok?: string) => {
    setBusy(name);
    try {
      await fn();
      if (ok) toast.good(ok);
      refresh();
    } catch (e) {
      toast.bad(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  if (res.error && !d) return <ErrorState message={res.error} onRetry={res.reload} />;
  if (!d || !inv) return <DetailSkeleton />;

  const s = settings.data?.settings;
  const isOpen = inv.state === "sent" && inv.balanceCents > 0;
  const reminders = d.events.filter((e) => e.kind === "invoice.reminded");

  const steps = [
    { id: "created", label: "Created", at: inv.createdAt, done: true, icon: <FilePen /> },
    { id: "sent", label: inv.sentAt ? "Sent" : "Not sent yet", at: inv.sentAt, done: !!inv.sentAt, icon: <Send /> },
    { id: "viewed", label: inv.viewedAt ? "Opened by " + inv.customerName.split(" ")[0] : "Not opened yet", at: inv.viewedAt, done: !!inv.viewedAt, icon: <Eye /> },
    ...reminders
      .slice()
      .reverse()
      .map((r) => ({ id: r.id, label: "Reminder sent", at: r.at, done: true, icon: <Bell /> })),
    ...(inv.status === "incoming" ? [{ id: "incoming", label: `${money(inv.pendingCents, inv.currency)} on its way`, at: null, done: false, icon: <Hourglass />, live: true }] : []),
    inv.state === "void"
      ? { id: "end", label: "Voided", at: inv.voidedAt, done: true, icon: <Ban /> }
      : { id: "end", label: inv.paidAt ? "Paid" : "Not paid yet", at: inv.paidAt, done: !!inv.paidAt, icon: <CircleDollarSign />, paid: true },
  ] as { id: string; label: string; at: number | null; done: boolean; icon: React.ReactNode; paid?: boolean; live?: boolean }[];

  return (
    <motion.div variants={stagger(0.05)} initial="hidden" animate="show">
      <motion.header variants={rise} className="page-head">
        <div className="grow">
          <Link href="/portal/invoicing/invoices" className="back">
            <ArrowLeft /> Invoices
          </Link>
          <div className="hstack wrap" style={{ gap: 12 }}>
            <h1>{inv.number}</h1>
            <StatusPill status={inv.status} size="lg" days={inv.daysOverdue} />
          </div>
          <p className="page-sub">
            <Link className="link" href={"/portal/invoicing/customers/" + inv.customerId}>
              {inv.customerName}
            </Link>
            {inv.state === "sent" ? " · " + dueText(inv.dueOn, inv.daysOverdue) : inv.state === "draft" ? " · Draft" : ""}
          </p>
        </div>
        <div className="page-actions">
          {inv.state === "draft" ? (
            <>
              <Button icon={<FilePen />} onClick={() => router.push("/portal/invoicing/invoices/new?id=" + inv.id)}>
                Edit
              </Button>
              <Button variant="primary" icon={<Send />} busy={busy === "send"} onClick={() => run("send", () => api.post<{ email: SendResult }>(`/portal/invoicing/api/invoices/${inv.id}/send`), `Sent to ${inv.customerEmail || inv.customerName}`)}>
                Send
              </Button>
            </>
          ) : isOpen ? (
            <>
              {inv.status !== "incoming" ? (
                <Button icon={<Bell />} onClick={() => setRemindOpen(true)}>
                  Remind
                </Button>
              ) : null}
              <Button variant="primary" icon={<CircleDollarSign />} onClick={() => setRecordOpen(true)}>
                Record payment
              </Button>
            </>
          ) : null}
          <Menu
            trigger={({ toggle, ref, open }) => (
              <Button ref={ref} iconOnly onClick={toggle} aria-label="More actions" aria-haspopup="menu" aria-expanded={open}>
                <Ellipsis />
              </Button>
            )}
          >
            {(close) => (
              <>
                {inv.state !== "draft" ? (
                  <a className="menu-item" role="menuitem" href={d.payUrl + "?preview=1"} target="_blank" rel="noreferrer" onClick={close}>
                    <ExternalLink /> See what they see
                  </a>
                ) : null}
                <a className="menu-item" role="menuitem" href={`/portal/invoicing/api/invoices/${inv.id}/pdf?download=1`} onClick={close}>
                  <Download /> Download PDF
                </a>
                <button
                  className="menu-item"
                  role="menuitem"
                  onClick={() => {
                    close();
                    run("dup", async () => {
                      const n = await api.post<Invoice>(`/portal/invoicing/api/invoices/${inv.id}/duplicate`);
                      router.push("/portal/invoicing/invoices/new?id=" + n.id);
                    });
                  }}
                >
                  <CopyPlus /> Duplicate
                </button>
                {inv.state === "sent" ? (
                  <button
                    className="menu-item danger"
                    role="menuitem"
                    onClick={() => {
                      close();
                      setVoidOpen(true);
                    }}
                  >
                    <Ban /> Void invoice
                  </button>
                ) : null}
                {inv.state === "draft" ? (
                  <button
                    className="menu-item danger"
                    role="menuitem"
                    onClick={() => {
                      close();
                      run("del", async () => {
                        await api.del(`/portal/invoicing/api/invoices/${inv.id}`);
                        invalidate("/portal/invoicing/api/invoices");
                        router.push("/portal/invoicing/invoices");
                      }, "Draft deleted");
                    }}
                  >
                    <Trash2 /> Delete draft
                  </button>
                ) : null}
              </>
            )}
          </Menu>
        </div>
      </motion.header>

      <AnimatePresence>
        {justSent ? (
          <motion.div
            className="notice notice-good sent-banner"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={spring}
            role="status"
          >
            <motion.span initial={reduce ? false : { x: -16, y: 10, rotate: -20, opacity: 0 }} animate={{ x: 0, y: 0, rotate: 0, opacity: 1 }} transition={{ duration: 0.5, ease }}>
              <Send />
            </motion.span>
            <span>
              On its way to <strong>{inv.customerEmail || inv.customerName}</strong>. Settled will mark it paid when the money lands.
            </span>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="detail">
        <motion.div variants={rise} className="stack-lg detail-main">
          <section className={"card card-pad balance-card" + (paidMoment ? " paid-glow" : "")}>
            <div className="balance-row">
              <div>
                <span className="small muted">{inv.state === "paid" ? "Paid in full" : inv.state === "void" ? "Voided" : "Balance due"}</span>
                <span className={"balance-amt" + (inv.state === "paid" ? " paid" : "")}>
                  <Num value={inv.state === "paid" ? inv.totalCents : inv.balanceCents} currency={inv.currency} countUp={false} />
                </span>
                <span className="small faint">
                  {inv.paidCents > 0 && inv.balanceCents > 0 ? `${money(inv.paidCents, inv.currency)} paid of ${money(inv.totalCents, inv.currency)}` : `Total ${money(inv.totalCents, inv.currency)}`}
                  {inv.paidAt ? " · paid " + dateTime(inv.paidAt) : ""}
                </span>
              </div>
              {inv.pendingCents > 0 ? (
                <span className="pill pill-incoming" data-s="incoming">
                  <span className="pill-dot" />
                  {money(inv.pendingCents, inv.currency)} on its way
                </span>
              ) : null}
            </div>
            {inv.state !== "draft" && inv.state !== "void" ? (
              <div style={{ marginTop: 16 }}>
                <span className="label" style={{ display: "block", marginBottom: 6 }}>
                  Pay link
                </span>
                <CopyField value={d.payUrl} label="Copy link" />
              </div>
            ) : null}
          </section>

          <div className="doc-wrap">
            <InvoiceDoc
              business={{
                name: s?.businessName ?? "",
                email: s?.email,
                phone: s?.phone,
                address: s?.address,
                website: s?.website,
                logo: s?.logo,
                brandColor: s?.brandColor,
                taxLabel: s?.taxLabel,
                taxRate: s?.taxRate,
                taxNumber: s?.taxNumber,
                footer: s?.footer,
              }}
              customer={{ name: inv.customerName, email: inv.customerEmail }}
              invoice={inv}
              animateBalance
              stamp={
                <AnimatePresence>
                  {inv.state === "paid" ? (
                    <motion.span
                      key="stamp"
                      className="doc-stamp"
                      initial={paidMoment && !reduce ? { opacity: 0, scale: 1.8, rotate: -20 } : false}
                      animate={{ opacity: 0.85, scale: 1, rotate: -9 }}
                      transition={{ type: "spring", stiffness: 380, damping: 18 }}
                    >
                      <CheckDraw size={18} stroke={3} play={paidMoment} /> Paid
                    </motion.span>
                  ) : null}
                </AnimatePresence>
              }
            />
          </div>
        </motion.div>

        <motion.aside variants={rise} className="stack-lg">
          <section className="card card-pad">
            <h2 className="card-title" style={{ marginBottom: 14 }}>
              Where it&apos;s at
            </h2>
            <ol className="timeline">
              {steps.map((st, i) => (
                <motion.li
                  key={st.id}
                  className={"tl-step" + (st.done ? " done" : "") + (st.paid && st.done ? " paid" : "") + (st.live ? " live" : "")}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.15 + i * 0.06, duration: 0.3, ease }}
                  layout
                >
                  <span className="tl-dot">{st.paid && st.done ? <CheckDraw size={13} stroke={3} play={paidMoment} /> : st.icon}</span>
                  <span className="grow">
                    <span className="tl-label">{st.label}</span>
                    {st.at ? <span className="tiny faint">{dateTime(st.at)}</span> : null}
                  </span>
                </motion.li>
              ))}
            </ol>
          </section>

          <section className="card">
            <div className="card-pad" style={{ paddingBottom: 8 }}>
              <h2 className="card-title">Payments</h2>
            </div>
            {d.payments.length === 0 ? (
              <p className="small muted" style={{ padding: "0 24px 20px" }}>
                Nothing yet. {isOpen ? "It marks itself paid when an e-Transfer or card payment lands." : ""}
              </p>
            ) : (
              <ul className="list">
                {d.payments.map((p) => (
                  <li key={p.id} className="list-row">
                    <MethodIcon method={p.method} badge />
                    <span className="cell-main">
                      <span className="cell-title" style={{ display: "block" }}>
                        {p.methodLabel}
                        {p.status === "clearing" ? <span className="small faint"> · on its way</span> : null}
                      </span>
                      <span className="cell-sub" style={{ display: "block" }}>
                        {day(p.receivedOn)}
                        {p.payerName ? " · " + p.payerName : ""}
                        {p.source === "etransfer_email" ? " · matched by Settled" : p.source === "stripe" ? " · paid online" : ""}
                      </span>
                    </span>
                    <span className="cell-amount">{money(p.allocations.find((a) => a.invoiceId === inv.id)?.amountCents ?? p.amountCents, inv.currency)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {d.emails.length ? (
            <section className="card">
              <div className="card-pad" style={{ paddingBottom: 8 }}>
                <h2 className="card-title">Emails</h2>
              </div>
              <ul className="list">
                {d.emails.map((e, i) => (
                  <li key={i} className="list-row">
                    <span className="ico" style={{ ["--ic" as string]: e.status === "failed" ? "var(--danger)" : "var(--st-sent)" }}>
                      <Mail />
                    </span>
                    <span className="cell-main">
                      <span className="cell-title" style={{ display: "block", textTransform: "capitalize" }}>
                        {e.kind.replace(/_/g, " ")}
                      </span>
                      <span className="cell-sub" style={{ display: "block" }}>
                        {e.to_addr} · {dateTime(e.at)}
                      </span>
                      {e.status === "failed" ? <span className="tiny" style={{ color: "var(--danger)" }}>Did not go out: {e.error}</span> : null}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {d.events.length ? (
            <section className="card">
              <div className="card-pad" style={{ paddingBottom: 0 }}>
                <h2 className="card-title">Activity</h2>
              </div>
              <Feed events={d.events} limit={20} />
            </section>
          ) : null}
        </motion.aside>
      </div>

      <RecordPayment open={recordOpen} onClose={() => setRecordOpen(false)} invoice={inv} onDone={() => refresh()} />

      <Dialog
        open={remindOpen}
        onClose={() => setRemindOpen(false)}
        title={`Remind ${inv.customerName.split(" ")[0]}`}
        description={`A friendly nudge about ${inv.number}, with the pay link. ${inv.remindersSent ? `${inv.remindersSent} sent so far.` : ""}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setRemindOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              icon={<Bell />}
              busy={busy === "remind"}
              onClick={() =>
                run("remind", async () => {
                  await api.post(`/portal/invoicing/api/invoices/${inv.id}/remind`, { message: remindMsg.trim() || undefined });
                  setRemindOpen(false);
                  setRemindMsg("");
                }, "Reminder sent")
              }
            >
              Send reminder
            </Button>
          </>
        }
      >
        <Field label="Add a note (optional)" htmlFor="rm-msg" hint="Leave it blank for Settled's usual polite wording.">
          <textarea id="rm-msg" className="textarea" value={remindMsg} onChange={(e) => setRemindMsg(e.target.value)} rows={3} />
        </Field>
      </Dialog>

      <Dialog
        open={voidOpen}
        onClose={() => setVoidOpen(false)}
        title={`Void ${inv.number}?`}
        description="It stays on record but nobody owes it any more, and reminders stop. This cannot be undone."
        footer={
          <>
            <Button variant="ghost" onClick={() => setVoidOpen(false)}>
              Keep it
            </Button>
            <Button
              variant="danger"
              icon={<Ban />}
              busy={busy === "void"}
              onClick={() =>
                run("void", async () => {
                  await api.post(`/portal/invoicing/api/invoices/${inv.id}/void`);
                  setVoidOpen(false);
                }, `${inv.number} voided`)
              }
            >
              Void invoice
            </Button>
          </>
        }
      />
    </motion.div>
  );
}

function DetailSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading invoice">
      <Sk w={90} h={13} style={{ marginBottom: 12 }} />
      <Sk w={220} h={32} style={{ marginBottom: 28 }} />
      <div className="detail">
        <div className="stack-lg">
          <Sk h={130} r={16} />
          <Sk h={460} r={16} />
        </div>
        <div className="stack-lg">
          <Sk h={260} r={16} />
          <Sk h={140} r={16} />
        </div>
      </div>
    </div>
  );
}

export default function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Suspense>
      <Detail id={id} />
    </Suspense>
  );
}
