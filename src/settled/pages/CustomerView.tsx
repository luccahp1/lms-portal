"use client";

import { AnimatePresence, motion } from "motion/react";
import { Archive, ArrowLeft, FilePlus, Mail, Pencil, Phone, Plus, Send, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { api, errorMessage } from "@/settled/lib/api";
import { day, dueText, money } from "@/settled/lib/format";
import { invalidate, useResource } from "@/settled/lib/hooks";
import type { Customer, CustomerDetail } from "@/settled/lib/types";
import { Num, rise, spring, stagger } from "@/settled/ui/motion";
import { useToast } from "@/settled/ui/toast";
import { Avatar, Button, ButtonLink, CopyField, Dialog, ErrorState, Input, Sk, StatusPill, Tabs } from "@/settled/ui/ui";
import { Feed } from "@/settled/parts/Feed";
import { MethodIcon } from "@/settled/parts/MethodIcon";

export default function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const key = "/portal/invoicing/api/customers/" + id;
  const res = useResource<CustomerDetail>(key);
  const toast = useToast();
  const [tab, setTab] = useState<"invoices" | "payments" | "activity">("invoices");
  const [editing, setEditing] = useState(false);
  const [sending, setSending] = useState(false);

  if (res.error && !res.data) return <ErrorState message={res.error} onRetry={res.reload} />;
  if (!res.data) {
    return (
      <div aria-busy="true">
        <Sk w={90} h={13} style={{ marginBottom: 14 }} />
        <div className="hstack" style={{ gap: 14, marginBottom: 24 }}>
          <Sk w={52} h={52} r={26} />
          <Sk w={220} h={30} />
        </div>
        <Sk h={120} r={16} style={{ marginBottom: 18 }} />
        <Sk h={300} r={16} />
      </div>
    );
  }

  const { customer: c, invoices, payments, creditCents, events, accountUrl } = res.data;
  const balance = invoices.filter((i) => i.state === "sent").reduce((s, i) => s + i.balanceCents, 0);
  const overdue = invoices.filter((i) => i.status === "overdue").reduce((s, i) => s + i.balanceCents, 0);
  const paidTotal = payments.filter((p) => p.status === "settled").reduce((s, p) => s + p.amountCents, 0);

  const statement = async () => {
    setSending(true);
    try {
      const r = await api.post<{ status: string; error?: string }>(`/portal/invoicing/api/customers/${id}/statement`);
      if (r.status === "sent") toast.good(`Sent ${c.name.split(" ")[0]} a link to their account`);
      else toast.bad(r.error || "That did not go out. Check their email address.");
    } catch (e) {
      toast.bad(errorMessage(e));
    } finally {
      setSending(false);
    }
  };

  const saveAliases = async (aliases: string[]) => {
    try {
      await api.patch<Customer>(key, { aliases });
      res.reload();
    } catch (e) {
      toast.bad(errorMessage(e));
    }
  };

  return (
    <motion.div variants={stagger(0.05)} initial="hidden" animate="show">
      <motion.header variants={rise} className="page-head">
        <div className="grow">
          <Link href="/portal/invoicing/customers" className="back">
            <ArrowLeft /> Customers
          </Link>
          <div className="hstack" style={{ gap: 14 }}>
            <Avatar name={c.name} size="lg" />
            <div style={{ minWidth: 0 }}>
              <h1 className="ellipsis">{c.name}</h1>
              {c.company && c.company !== c.name ? <p className="page-sub">{c.company}</p> : null}
            </div>
          </div>
        </div>
        <div className="page-actions">
          <Button icon={<Pencil />} onClick={() => setEditing(true)}>
            Edit
          </Button>
          <Button icon={<Send />} onClick={statement} busy={sending} disabled={!c.email} title={c.email ? "" : "Add an email first"}>
            Email their account
          </Button>
          <ButtonLink href="/portal/invoicing/invoices/new" variant="primary" icon={<FilePlus />}>
            New invoice
          </ButtonLink>
        </div>
      </motion.header>

      <motion.section variants={rise} className="cust-stats">
        <div className="card stat">
          <span className="stat-label">Owes you</span>
          <span className="stat-value">
            <Num value={balance} />
          </span>
          <span className="stat-foot">{overdue ? <span className="late-text">{money(overdue)} overdue</span> : "Nothing late"}</span>
        </div>
        <div className="card stat">
          <span className="stat-label">Credit</span>
          <span className="stat-value">
            <Num value={creditCents} />
          </span>
          <span className="stat-foot">{creditCents ? "Used on their next invoice" : "None"}</span>
        </div>
        <div className="card stat stat-good">
          <span className="stat-label">Paid you</span>
          <span className="stat-value">
            <Num value={paidTotal} />
          </span>
          <span className="stat-foot">{payments.length} payments</span>
        </div>
      </motion.section>

      <div className="detail">
        <motion.div variants={rise} className="stack-lg">
          <section className="card">
            <div style={{ padding: "6px 16px 0" }}>
              <Tabs
                id="cust-tabs"
                label="Customer records"
                value={tab}
                onChange={setTab}
                items={[
                  { value: "invoices", label: "Invoices", badge: invoices.length || null },
                  { value: "payments", label: "Payments", badge: payments.length || null },
                  { value: "activity", label: "Activity" },
                ]}
              />
            </div>
            <AnimatePresence mode="wait">
              <motion.div key={tab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                {tab === "invoices" ? (
                  invoices.length ? (
                    <ul className="list">
                      {invoices.map((i) => (
                        <li key={i.id}>
                          <Link href={"/portal/invoicing/invoices/" + i.id} className="list-row">
                            <span className="cell-main">
                              <span className="cell-title" style={{ display: "block" }}>
                                {i.number}
                              </span>
                              <span className="cell-sub" style={{ display: "block" }}>
                                {i.state === "sent" ? dueText(i.dueOn, i.daysOverdue) : i.issuedOn ? "Issued " + day(i.issuedOn) : "Draft"}
                              </span>
                            </span>
                            <StatusPill status={i.status} />
                            <span className="cell-amount" style={{ minWidth: 90 }}>
                              {money(i.state === "sent" ? i.balanceCents : i.totalCents)}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="small muted" style={{ padding: 24 }}>
                      No invoices yet.
                    </p>
                  )
                ) : tab === "payments" ? (
                  payments.length ? (
                    <ul className="list">
                      {payments.map((p) => (
                        <li key={p.id} className="list-row">
                          <MethodIcon method={p.method} badge />
                          <span className="cell-main">
                            <span className="cell-title" style={{ display: "block" }}>
                              {p.methodLabel} · {day(p.receivedOn)}
                            </span>
                            <span className="cell-sub" style={{ display: "block" }}>
                              {p.allocations.length ? p.allocations.map((a) => a.invoiceNumber).join(", ") : "Kept as credit"}
                              {p.payerName && p.payerName !== c.name ? " · from " + p.payerName : ""}
                            </span>
                          </span>
                          <span className="cell-amount">{money(p.amountCents)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="small muted" style={{ padding: 24 }}>
                      No payments yet.
                    </p>
                  )
                ) : events.length ? (
                  <Feed events={events} limit={30} />
                ) : (
                  <p className="small muted" style={{ padding: 24 }}>
                    Nothing yet.
                  </p>
                )}
              </motion.div>
            </AnimatePresence>
          </section>
        </motion.div>

        <motion.aside variants={rise} className="stack-lg">
          <section className="card card-pad stack-sm">
            <h2 className="card-title">Contact</h2>
            {c.email ? (
              <a className="contact-line" href={"mailto:" + c.email}>
                <Mail /> {c.email}
              </a>
            ) : (
              <span className="small faint">No email yet. Add one so invoices and reminders can go out.</span>
            )}
            {c.phone ? (
              <a className="contact-line" href={"tel:" + c.phone}>
                <Phone /> {c.phone}
              </a>
            ) : null}
            {c.address ? <p className="small muted" style={{ whiteSpace: "pre-line" }}>{c.address}</p> : null}
            {c.notes ? <p className="small muted">{c.notes}</p> : null}
          </section>

          <Aliases aliases={c.aliases} payerEmails={c.payerEmails} onSave={saveAliases} />

          <section className="card card-pad">
            <h2 className="card-title">Their account page</h2>
            <p className="small muted" style={{ margin: "4px 0 12px" }}>
              Everything they owe, with a pay link for each. No sign-in needed.
            </p>
            <CopyField value={accountUrl} label="Copy" />
          </section>
        </motion.aside>
      </div>

      <EditCustomer open={editing} customer={c} onClose={() => setEditing(false)} onSaved={() => (res.reload(), invalidate("/portal/invoicing/api/customers"))} />
    </motion.div>
  );
}

function Aliases({ aliases, payerEmails, onSave }: { aliases: string[]; payerEmails: string[]; onSave: (a: string[]) => void }) {
  const [adding, setAdding] = useState("");
  return (
    <section className="card card-pad">
      <div className="hstack" style={{ gap: 8 }}>
        <Sparkles style={{ width: 16, height: 16, color: "var(--accent)" }} />
        <h2 className="card-title">Names Settled knows them by</h2>
      </div>
      <p className="small muted" style={{ margin: "4px 0 12px" }}>
        When money arrives under one of these, it matches by itself. Settled adds names when you confirm a payment.
      </p>
      <div className="chips">
        <AnimatePresence initial={false}>
          {aliases.map((a) => (
            <motion.span key={a} layout className="alias" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} transition={spring}>
              {a}
              <button type="button" onClick={() => onSave(aliases.filter((x) => x !== a))} aria-label={`Forget ${a}`}>
                <X />
              </button>
            </motion.span>
          ))}
          {payerEmails.map((e) => (
            <motion.span key={e} layout className="alias alias-mail">
              <Mail /> {e}
            </motion.span>
          ))}
        </AnimatePresence>
        {!aliases.length && !payerEmails.length ? <span className="small faint">None yet.</span> : null}
      </div>
      <form
        className="hstack"
        style={{ marginTop: 12 }}
        onSubmit={(e) => {
          e.preventDefault();
          const v = adding.trim();
          if (v && !aliases.includes(v)) onSave([...aliases, v]);
          setAdding("");
        }}
      >
        <input className="input" value={adding} onChange={(e) => setAdding(e.target.value)} placeholder="Add a name, e.g. J SMITH" aria-label="Add a name" style={{ height: 36 }} />
        <Button type="submit" size="sm" icon={<Plus />} disabled={!adding.trim()}>
          Add
        </Button>
      </form>
    </section>
  );
}

function EditCustomer({ open, customer, onClose, onSaved }: { open: boolean; customer: Customer; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState(customer);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (open) {
      setF(customer);
      setError(null);
    }
  }, [open, customer]);
  const set = (k: keyof Customer) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((x) => ({ ...x, [k]: e.target.value }));
  const save = async (extra: Partial<Customer> & { archived?: boolean } = {}) => {
    setBusy(true);
    setError(null);
    try {
      await api.patch(`/portal/invoicing/api/customers/${customer.id}`, { name: f.name, company: f.company, email: f.email, phone: f.phone, address: f.address, notes: f.notes, ...extra });
      toast.good(extra.archived ? `${customer.name} archived` : "Saved");
      onSaved();
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Edit customer"
      footer={
        <>
          <Button variant="danger" icon={<Archive />} onClick={() => save({ archived: !customer.archived })} style={{ marginRight: "auto" }}>
            {customer.archived ? "Unarchive" : "Archive"}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" busy={busy} onClick={() => save()}>
            Save
          </Button>
        </>
      }
    >
      <div className="stack">
        <div className="row-fields">
          <Input label="Name" value={f.name} onChange={set("name")} />
          <Input label="Company" value={f.company} onChange={set("company")} />
        </div>
        <div className="row-fields">
          <Input label="Email" type="email" value={f.email} onChange={set("email")} />
          <Input label="Phone" type="tel" value={f.phone} onChange={set("phone")} />
        </div>
        <div className="field">
          <label htmlFor="ec-addr">Address</label>
          <textarea id="ec-addr" className="textarea" rows={2} value={f.address} onChange={set("address")} />
        </div>
        <div className="field">
          <label htmlFor="ec-notes">Notes</label>
          <textarea id="ec-notes" className="textarea" rows={2} value={f.notes} onChange={set("notes")} />
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
