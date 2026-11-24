"use client";

import { AnimatePresence, motion } from "motion/react";
import { ArrowRightLeft, CircleDollarSign, Copy, Ellipsis, Landmark, Link2, Sparkles, Trash2, Upload, Wallet } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { api, errorMessage, qs } from "@/settled/lib/api";
import { centsToInput, day, inputToCents, money, plural } from "@/settled/lib/format";
import { invalidate, useResource } from "@/settled/lib/hooks";
import type { BankImportResult, Invoice, Payment } from "@/settled/lib/types";
import { Num, ease, spring } from "@/settled/ui/motion";
import { useToast } from "@/settled/ui/toast";
import { Button, Dialog, Empty, ErrorState, ListSkeleton, Menu, PageHead, Pill } from "@/settled/ui/ui";
import { DropZone } from "@/settled/parts/DropZone";
import { MethodIcon } from "@/settled/parts/MethodIcon";
import { RecordPayment } from "@/settled/parts/RecordPayment";
import { SUMMARY_KEY } from "@/settled/shell/Frame";

const KEY = "/portal/invoicing/api/payments";

const SOURCE: Record<string, string> = {
  manual: "Recorded by you",
  etransfer_email: "Matched by Settled",
  stripe: "Paid online",
  bank_import: "From bank statement",
  import: "Imported",
};

function Payments() {
  const params = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const res = useResource<{ payments: Payment[] }>(KEY, { poll: 30_000 });
  const [recordOpen, setRecordOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [moving, setMoving] = useState<Payment | null>(null);
  const [removing, setRemoving] = useState<Payment | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (params.get("record") === "1") setRecordOpen(true);
    if (params.get("import") === "1") setImportOpen(true);
    if (params.get("record") || params.get("import")) router.replace("/portal/invoicing/payments", { scroll: false });
  }, [params, router]);

  const all = () => invalidate(KEY, "/portal/invoicing/api/invoices", "/portal/invoicing/api/customers", "/portal/invoicing/api/activity", SUMMARY_KEY);

  const remove = async () => {
    if (!removing) return;
    setBusy(true);
    try {
      await api.del(`/portal/invoicing/api/payments/${removing.id}`);
      toast.good("Payment removed. Its invoices are unpaid again.");
      setRemoving(null);
      all();
    } catch (e) {
      toast.bad(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const list = res.data?.payments;
  const total = list?.filter((p) => p.status === "settled").reduce((s, p) => s + p.amountCents, 0) ?? 0;

  return (
    <>
      <PageHead
        title="Payments"
        sub={list ? `${plural(list.length, "payment")} · ${money(total)} received` : " "}
        actions={
          <>
            <Button icon={<Upload />} onClick={() => setImportOpen(true)}>
              Import bank statement
            </Button>
            <Button variant="primary" icon={<CircleDollarSign />} onClick={() => setRecordOpen(true)}>
              Record payment
            </Button>
          </>
        }
      />
      <section className="card list-card">
        {res.error && !list ? (
          <ErrorState message={res.error} onRetry={res.reload} />
        ) : !list ? (
          <ListSkeleton />
        ) : list.length === 0 ? (
          <Empty
            icon={<Wallet />}
            title="No payments yet"
            action={
              <Button variant="primary" icon={<CircleDollarSign />} onClick={() => setRecordOpen(true)}>
                Record a payment
              </Button>
            }
          >
            e-Transfers and card payments show up here by themselves. Cheques and cash you can record, or catch them all with a bank statement.
          </Empty>
        ) : (
          <motion.ul className="list" initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.025 } } }}>
            <AnimatePresence initial={false}>
              {list.map((p) => (
                <motion.li key={p.id} layout variants={{ hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0 } }} exit={{ opacity: 0, x: -20 }} transition={spring}>
                  <div className="list-row pay-row">
                    <MethodIcon method={p.method} badge />
                    <span className="cell-main">
                      <span className="cell-title" style={{ display: "block" }}>
                        {p.customerId ? (
                          <Link href={"/portal/invoicing/customers/" + p.customerId} className="hover-u">
                            {p.customerName}
                          </Link>
                        ) : (
                          p.payerName || "Unknown payer"
                        )}
                        <span className="faint" style={{ fontWeight: 400 }}>
                          {" "}
                          · {p.methodLabel}
                        </span>
                      </span>
                      <span className="cell-sub pay-where" style={{ display: "block" }}>
                        {day(p.receivedOn)} · {SOURCE[p.source] ?? p.source}
                        {p.allocations.length ? (
                          <>
                            {" · "}
                            {p.allocations.map((a, i) => (
                              <span key={a.invoiceId}>
                                {i ? ", " : ""}
                                <Link className="link" href={"/portal/invoicing/invoices/" + a.invoiceId}>
                                  {a.invoiceNumber}
                                </Link>
                              </span>
                            ))}
                          </>
                        ) : null}
                        {p.unappliedCents > 0 ? ` · ${money(p.unappliedCents)} credit` : ""}
                      </span>
                    </span>
                    {p.status !== "settled" ? <Pill tone={p.status === "clearing" ? "incoming" : "danger"}>{p.status === "clearing" ? "On its way" : "Failed"}</Pill> : null}
                    <span className="cell-amount">{money(p.amountCents)}</span>
                    <Menu
                      trigger={({ toggle, ref, open }) => (
                        <button ref={ref} type="button" className="btn btn-ghost btn-icon btn-sm" onClick={toggle} aria-label={`Actions for payment of ${money(p.amountCents)}`} aria-haspopup="menu" aria-expanded={open}>
                          <Ellipsis />
                        </button>
                      )}
                    >
                      {(close) => (
                        <>
                          {p.customerId && p.status === "settled" ? (
                            <button className="menu-item" role="menuitem" onClick={() => (close(), setMoving(p))}>
                              <ArrowRightLeft /> Move to other invoices
                            </button>
                          ) : null}
                          {p.reference ? (
                            <button
                              className="menu-item"
                              role="menuitem"
                              onClick={() => {
                                navigator.clipboard?.writeText(p.reference);
                                toast.good("Reference copied");
                                close();
                              }}
                            >
                              <Copy /> Copy reference {p.reference.slice(0, 12)}
                            </button>
                          ) : null}
                          <button className="menu-item danger" role="menuitem" onClick={() => (close(), setRemoving(p))}>
                            <Trash2 /> Remove payment
                          </button>
                        </>
                      )}
                    </Menu>
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </motion.ul>
        )}
      </section>

      <RecordPayment open={recordOpen} onClose={() => setRecordOpen(false)} />
      <BankImport open={importOpen} onClose={() => setImportOpen(false)} onDone={all} />
      <MovePayment payment={moving} onClose={() => setMoving(null)} onDone={all} />
      <Dialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        title="Remove this payment?"
        description={removing ? `${money(removing.amountCents)} from ${removing.customerName || removing.payerName}. The invoices it paid go back to unpaid and reminders pick up again.` : ""}
        footer={
          <>
            <Button variant="ghost" onClick={() => setRemoving(null)}>
              Keep it
            </Button>
            <Button variant="danger" icon={<Trash2 />} busy={busy} onClick={remove}>
              Remove
            </Button>
          </>
        }
      />
    </>
  );
}

function BankImport({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<BankImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (open) {
      setResult(null);
      setError(null);
    }
  }, [open]);
  const upload = async (f: File) => {
    setBusy(true);
    setError(null);
    try {
      const r = await api.post<BankImportResult>("/portal/invoicing/api/imports/bank", f, { contentType: "text/csv" });
      setResult(r);
      onDone();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const tiles = result
    ? [
        { n: result.matched, label: "matched to invoices", icon: <Sparkles />, color: "var(--st-paid)" },
        { n: result.alreadyRecorded, label: "already recorded, linked", icon: <Link2 />, color: "var(--st-sent)" },
        { n: result.review, label: "waiting for a look", icon: <Landmark />, color: "var(--st-partial)", href: "/portal/invoicing/inbox" },
        { n: result.duplicates, label: "duplicates skipped", icon: <Copy />, color: "var(--text-3)" },
      ]
    : [];
  return (
    <Dialog open={open} onClose={onClose} title="Import a bank statement" description="Catches cheques, cash and anything that never sent an email. Lines already recorded are linked, not counted twice." wide>
      <AnimatePresence mode="wait">
        {!result ? (
          <motion.div key="drop" exit={{ opacity: 0, scale: 0.98 }} className="stack">
            <DropZone onFile={upload} busy={busy} title="Drop your bank's CSV export here" />
            <p className="tiny faint">Works with the CSV download from any Canadian bank: a signed Amount column, or separate Withdrawal and Deposit columns. Only money in is used.</p>
            {error ? (
              <div className="notice notice-danger" role="alert">
                {error}
              </div>
            ) : null}
          </motion.div>
        ) : (
          <motion.div key="res" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="stack">
            <p className="muted">
              Read {plural(result.rows, "line")}, {plural(result.credits, "deposit")}.
            </p>
            <div className="import-tiles">
              {tiles.map((t, i) => (
                <motion.div
                  key={t.label}
                  className="import-tile"
                  style={{ ["--ic" as string]: t.color }}
                  initial={{ opacity: 0, y: 12, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ delay: 0.08 + i * 0.08, duration: 0.4, ease }}
                >
                  <span className="ico">{t.icon}</span>
                  <span className="import-n">
                    <Num value={t.n} format="int" />
                  </span>
                  <span className="small muted">{t.label}</span>
                  {t.href && t.n ? (
                    <Link href={t.href} className="link tiny" onClick={onClose}>
                      Review now
                    </Link>
                  ) : null}
                </motion.div>
              ))}
            </div>
            {result.skipped.length ? (
              <details className="small muted">
                <summary>{plural(result.skipped.length, "line")} skipped</summary>
                <ul>
                  {result.skipped.slice(0, 20).map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </details>
            ) : null}
            <div className="dialog-foot" style={{ marginTop: 6 }}>
              <Button onClick={() => setResult(null)}>Import another</Button>
              <Button variant="primary" onClick={onClose}>
                Done
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Dialog>
  );
}

function MovePayment({ payment, onClose, onDone }: { payment: Payment | null; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const res = useResource<{ invoices: Invoice[] }>(payment?.customerId ? "/portal/invoicing/api/invoices" + qs({ customerId: payment.customerId, limit: 100 }) : null);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!payment) return;
    const a: Record<string, string> = {};
    for (const al of payment.allocations) a[al.invoiceId] = centsToInput(al.amountCents);
    setAmounts(a);
    setError(null);
  }, [payment]);

  const invs = (res.data?.invoices ?? []).filter((i) => i.state !== "void" && i.state !== "draft" && (i.balanceCents > 0 || amounts[i.id]));
  const used = Object.values(amounts).reduce((s, v) => s + (inputToCents(v) ?? 0), 0);
  const left = (payment?.amountCents ?? 0) - used;

  const save = async (auto?: boolean) => {
    if (!payment) return;
    setBusy(true);
    setError(null);
    try {
      const body = auto
        ? { auto: true }
        : { allocations: Object.entries(amounts).map(([invoiceId, v]) => ({ invoiceId, amountCents: inputToCents(v) ?? 0 })).filter((a) => a.amountCents > 0) };
      await api.patch(`/portal/invoicing/api/payments/${payment.id}`, body);
      toast.good("Payment moved");
      onDone();
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={!!payment}
      onClose={onClose}
      title="Move this payment"
      description={payment ? `${money(payment.amountCents)} from ${payment.customerName}. Say how much goes on each invoice.` : ""}
      footer={
        <>
          <Button variant="ghost" onClick={() => save(true)} disabled={busy} style={{ marginRight: "auto" }}>
            Let Settled decide
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" busy={busy} onClick={() => save()} disabled={left < 0}>
            Save
          </Button>
        </>
      }
    >
      <div className="stack">
        <div className="pick-list" style={{ maxHeight: 320 }}>
          {invs.map((i) => (
            <div key={i.id} className="pick-row" style={{ cursor: "default" }}>
              <span className="grow">
                <span className="bold">{i.number}</span>{" "}
                <span className="small faint">owes {money(i.balanceCents + (inputToCents(amounts[i.id] ?? "") ?? 0) - (payment?.allocations.find((a) => a.invoiceId === i.id)?.amountCents ?? 0))}</span>
              </span>
              <div className="input-wrap" style={{ width: 120 }}>
                <span className="input-prefix">$</span>
                <input
                  className="input num"
                  style={{ height: 36, textAlign: "right" }}
                  inputMode="decimal"
                  value={amounts[i.id] ?? ""}
                  placeholder="0.00"
                  onChange={(e) => setAmounts((a) => ({ ...a, [i.id]: e.target.value }))}
                  aria-label={`Amount on ${i.number}`}
                />
              </div>
            </div>
          ))}
          {res.data && !invs.length ? <span className="hint">No open invoices for this customer.</span> : null}
        </div>
        <div className={"small " + (left < 0 ? "late-text" : "muted")}>
          {left < 0 ? `${money(-left)} more than the payment.` : left > 0 ? `${money(left)} left over stays as credit.` : "All of it is placed."}
        </div>
        {error ? (
          <div className="notice notice-danger" role="alert">
            {error}
          </div>
        ) : null}
      </div>
    </Dialog>
  );
}

export default function PaymentsPage() {
  return (
    <Suspense>
      <Payments />
    </Suspense>
  );
}
