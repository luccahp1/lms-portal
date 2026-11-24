"use client";

import { motion } from "motion/react";
import { ArrowLeft, CheckCheck, Save, Send } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { api, errorMessage } from "@/settled/lib/api";
import { addDaysStr, daysBetween, dayLong, money, todayStr } from "@/settled/lib/format";
import { invalidate, useResource } from "@/settled/lib/hooks";
import type { Invoice, InvoiceDetail, SendResult, SettingsOut } from "@/settled/lib/types";
import { Num, rise, stagger } from "@/settled/ui/motion";
import { useToast } from "@/settled/ui/toast";
import { Button, Chips, Dialog, Field, Sk } from "@/settled/ui/ui";
import { CustomerPicker } from "@/settled/parts/CustomerPicker";
import { LineItems, newRow, rowsFromItems, rowsToItems, totalsOf, type Row } from "@/settled/parts/LineItems";
import { SUMMARY_KEY } from "@/settled/shell/Frame";

type Preset = "0" | "7" | "14" | "30" | "custom";

function Builder() {
  const params = useSearchParams();
  const editId = params.get("id");
  const router = useRouter();
  const toast = useToast();
  const settings = useResource<SettingsOut>("/portal/invoicing/api/settings");
  const existing = useResource<InvoiceDetail>(editId ? "/portal/invoicing/api/invoices/" + editId : null);

  const [customer, setCustomer] = useState<{ id: string; name: string; email: string } | null>(null);
  const [rows, setRows] = useState<Row[]>([newRow()]);
  const [issuedOn, setIssuedOn] = useState(todayStr());
  const [preset, setPreset] = useState<Preset>("14");
  const [dueOn, setDueOn] = useState(addDaysStr(todayStr(), 14));
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | "draft" | "sent" | "send">(null);
  const [sendOpen, setSendOpen] = useState(false);
  const [to, setTo] = useState("");
  const [message, setMessage] = useState("");
  const [loaded, setLoaded] = useState(false);

  const s = settings.data?.settings;

  // Default terms from settings, once.
  useEffect(() => {
    if (!s || editId || loaded) return;
    const t = s.termsDays;
    const p: Preset = t === 0 ? "0" : t === 7 ? "7" : t === 14 ? "14" : t === 30 ? "30" : "custom";
    setPreset(p);
    setDueOn(addDaysStr(todayStr(), t));
    setLoaded(true);
  }, [s, editId, loaded]);

  // Editing a draft: fill the form.
  useEffect(() => {
    const inv = existing.data?.invoice;
    if (!inv || loaded) return;
    setCustomer({ id: inv.customerId, name: inv.customerName, email: inv.customerEmail });
    setRows(inv.items.length ? rowsFromItems(inv.items) : [newRow()]);
    setIssuedOn(inv.issuedOn || todayStr());
    setNotes(inv.notes);
    if (!inv.dueOn) {
      setPreset("0");
    } else {
      const d = daysBetween(inv.issuedOn || todayStr(), inv.dueOn);
      setPreset(d === 7 ? "7" : d === 14 ? "14" : d === 30 ? "30" : "custom");
      setDueOn(inv.dueOn);
    }
    setLoaded(true);
  }, [existing.data, loaded]);

  const setP = (p: Preset) => {
    setPreset(p);
    if (p !== "custom" && p !== "0") setDueOn(addDaysStr(issuedOn, Number(p)));
  };
  useEffect(() => {
    if (preset !== "custom" && preset !== "0") setDueOn(addDaysStr(issuedOn, Number(preset)));
  }, [issuedOn, preset]);

  const taxRate = s?.taxRate ?? 0;
  const t = totalsOf(rows, taxRate);
  const items = rowsToItems(rows);

  const check = (): string | null => {
    if (!customer) return "Pick who this invoice is for.";
    if (!items.length) return "Add at least one line.";
    return null;
  };

  const save = async (): Promise<Invoice> => {
    const body = { customerId: customer!.id, items, issuedOn, dueOn: preset === "0" ? null : dueOn, notes };
    if (editId) return api.patch<Invoice>("/portal/invoicing/api/invoices/" + editId, body);
    return api.post<Invoice>("/portal/invoicing/api/invoices", body);
  };

  const done = (inv: Invoice, what: string) => {
    invalidate("/portal/invoicing/api/invoices", "/portal/invoicing/api/activity", SUMMARY_KEY, "/portal/invoicing/api/customers", "/portal/invoicing/api/me");
    toast.good(what);
    router.push("/portal/invoicing/invoices/" + inv.id + (what.startsWith("Sent") ? "?sent=1" : ""));
  };

  const act = async (kind: "draft" | "sent") => {
    const e = check();
    if (e) return setError(e);
    setError(null);
    setBusy(kind);
    try {
      let inv = await save();
      if (kind === "sent") inv = await api.post<Invoice>(`/portal/invoicing/api/invoices/${inv.id}/mark-sent`);
      done(inv, kind === "draft" ? "Draft saved" : `Marked ${inv.number} as sent`);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(null);
    }
  };

  const openSend = () => {
    const e = check();
    if (e) return setError(e);
    setError(null);
    setTo(customer!.email);
    setMessage("");
    setSendOpen(true);
  };

  const send = async () => {
    setBusy("send");
    try {
      const inv = await save();
      const r = await api.post<{ invoice: Invoice; email: SendResult }>(`/portal/invoicing/api/invoices/${inv.id}/send`, { to, message: message.trim() || undefined });
      if (r.email.status === "failed") toast.bad("The email did not go out: " + (r.email.error || "unknown reason"));
      done(r.invoice, `Sent ${r.invoice.number} to ${to}`);
    } catch (err) {
      setError(errorMessage(err));
      setSendOpen(false);
      setBusy(null);
    }
  };

  if (editId && existing.data && existing.data.invoice.state !== "draft") {
    return (
      <div className="empty">
        <h3>Only drafts can be edited here</h3>
        <Link className="link" href={"/portal/invoicing/invoices/" + editId}>
          Back to the invoice
        </Link>
      </div>
    );
  }

  const first = customer?.name.split(" ")[0] || "there";
  const defaultNote = `Here is invoice ${editId ? existing.data?.invoice.number ?? "" : "INV-…"} for ${money(t.total)}${preset === "0" ? "" : ", due " + dayLong(dueOn)}. The PDF is attached.`;

  return (
    <motion.div variants={stagger(0.05)} initial="hidden" animate="show">
      <motion.div variants={rise} className="page-head">
        <div>
          <Link href="/portal/invoicing/invoices" className="back">
            <ArrowLeft /> Invoices
          </Link>
          <h1>{editId ? "Edit draft" : "New invoice"}</h1>
        </div>
      </motion.div>

      <div className="builder">
        <motion.div variants={rise} className="stack-lg">
          <section className="card card-pad">
            <h2 className="card-title" style={{ marginBottom: 12 }}>
              Bill to
            </h2>
            {editId && !loaded ? <Sk h={42} /> : <CustomerPicker value={customer?.id ?? null} onChange={setCustomer} autoFocus={!editId} />}
          </section>

          <section className="card card-pad">
            <h2 className="card-title" style={{ marginBottom: 12 }}>
              What it&apos;s for
            </h2>
            <LineItems rows={rows} setRows={setRows} taxRate={taxRate} taxLabel={s?.taxLabel ?? "Tax"} currency={s?.currency} />
          </section>

          <section className="card card-pad stack">
            <div className="row-fields">
              <Field label="Issued" htmlFor="issued">
                <input id="issued" type="date" className="input" value={issuedOn} onChange={(e) => setIssuedOn(e.target.value || todayStr())} />
              </Field>
              <Field label="Due" htmlFor="due">
                <input id="due" type="date" className="input" value={preset === "0" ? issuedOn : dueOn} disabled={preset === "0"} onChange={(e) => {
                  setPreset("custom");
                  setDueOn(e.target.value);
                }} />
              </Field>
            </div>
            <Chips
              id="due-preset"
              label="Payment terms"
              value={preset}
              onChange={setP}
              items={[
                { value: "0", label: "On receipt" },
                { value: "7", label: "7 days" },
                { value: "14", label: "14 days" },
                { value: "30", label: "30 days" },
                { value: "custom", label: "Pick a date" },
              ]}
            />
            <Field label="Notes" htmlFor="notes" hint="Shown on the invoice. A thank-you, job details, anything they should know.">
              <textarea id="notes" className="textarea" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
            </Field>
          </section>
        </motion.div>

        <motion.aside variants={rise} className="builder-side">
          <div className="card card-pad builder-sum">
            <span className="small muted">Total</span>
            <span className="builder-total">
              <Num value={t.total} currency={s?.currency} countUp={false} />
            </span>
            <span className="small faint">
              {customer ? customer.name : "No customer yet"} · {preset === "0" ? "Due on receipt" : "Due " + dayLong(dueOn)}
            </span>
            {error ? (
              <div className="notice notice-danger" role="alert" style={{ marginTop: 14 }}>
                {error}
              </div>
            ) : null}
            <div className="stack-sm" style={{ marginTop: 18 }}>
              <Button variant="primary" size="lg" block icon={<Send />} onClick={openSend} disabled={!!busy}>
                Send invoice
              </Button>
              <div className="hstack">
                <Button block icon={<Save />} onClick={() => act("draft")} busy={busy === "draft"} disabled={!!busy}>
                  Save draft
                </Button>
                <Button block icon={<CheckCheck />} onClick={() => act("sent")} busy={busy === "sent"} disabled={!!busy} title="Mark as sent without emailing, for when you hand it over yourself">
                  Mark sent
                </Button>
              </div>
            </div>
            <p className="tiny faint" style={{ marginTop: 14 }}>
              Sending emails a PDF and a pay link. When they pay by e-Transfer or card, it marks itself paid.
            </p>
          </div>
        </motion.aside>
      </div>

      <Dialog
        open={sendOpen}
        onClose={() => setSendOpen(false)}
        title="Send the invoice"
        description="Here is what they will get. Change anything you like."
        wide
        footer={
          <>
            <Button variant="ghost" onClick={() => setSendOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" icon={<Send />} onClick={send} busy={busy === "send"}>
              Send {money(t.total)}
            </Button>
          </>
        }
      >
        <div className="stack">
          <Field label="To" htmlFor="to" hint={!to ? "This customer has no email yet. Add one, or mark it sent and share the link yourself." : undefined}>
            <input id="to" type="email" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
          <div className="mail-preview">
            <div className="mail-subject">
              Invoice from {s?.businessName}: {money(t.total)}
            </div>
            <p>Hi {first},</p>
            <textarea className="textarea mail-msg" value={message} onChange={(e) => setMessage(e.target.value)} placeholder={defaultNote} aria-label="Message" rows={3} />
            <span className="mail-btn">View and pay {money(t.total)}</span>
            <p className="tiny faint">The PDF is attached. Pay by e-Transfer{settings.data?.connected.stripe ? ", card or bank debit" : ""} from the link.</p>
          </div>
        </div>
      </Dialog>
    </motion.div>
  );
}

export default function NewInvoicePage() {
  return (
    <Suspense>
      <Builder />
    </Suspense>
  );
}
