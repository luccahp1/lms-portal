"use client";

import { Check } from "lucide-react";
import { useEffect, useState } from "react";
import { api, errorMessage, qs } from "@/settled/lib/api";
import { centsToInput, dueText, inputToCents, money, todayStr } from "@/settled/lib/format";
import { invalidate, useResource } from "@/settled/lib/hooks";
import type { Invoice, Method, Payment } from "@/settled/lib/types";
import { useToast } from "@/settled/ui/toast";
import { Button, Dialog, Field } from "@/settled/ui/ui";
import { SUMMARY_KEY } from "@/settled/shell/Frame";
import { CustomerPicker } from "@/settled/parts/CustomerPicker";
import { MethodIcon } from "@/settled/parts/MethodIcon";

export const METHODS: { value: Method; label: string }[] = [
  { value: "etransfer", label: "e-Transfer" },
  { value: "cheque", label: "Cheque" },
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "bank_debit", label: "Bank debit" },
  { value: "other", label: "Other" },
];

/**
 * Record money that arrived some other way. From an invoice it goes on that
 * invoice; otherwise pick the customer and either let Settled place it
 * (exact match first, then oldest) or tick the invoices yourself.
 */
export function RecordPayment({
  open,
  onClose,
  invoice,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  invoice?: Invoice;
  onDone?: (p: Payment) => void;
}) {
  const toast = useToast();
  const [customer, setCustomer] = useState<{ id: string; name: string; email: string } | null>(null);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<Method>("etransfer");
  const [receivedOn, setReceivedOn] = useState(todayStr());
  const [reference, setReference] = useState("");
  const [mode, setMode] = useState<"auto" | "pick">("auto");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const cid = invoice?.customerId ?? customer?.id ?? null;
  const openInv = useResource<{ invoices: Invoice[] }>(!invoice && cid ? "/portal/invoicing/api/invoices" + qs({ customerId: cid, status: "open", limit: 50 }) : null);

  useEffect(() => {
    if (!open) return;
    setAmount(invoice ? centsToInput(invoice.balanceCents) : "");
    setMethod("etransfer");
    setReceivedOn(todayStr());
    setReference("");
    setMode("auto");
    setPicked(new Set());
    setError(null);
    if (!invoice) setCustomer(null);
  }, [open, invoice]);

  const submit = async () => {
    const cents = inputToCents(amount);
    if (!cents || cents <= 0) return setError("Enter the amount you received.");
    if (!cid) return setError("Pick who paid.");
    setBusy(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { customerId: cid, amountCents: cents, method, receivedOn, reference };
      if (invoice) body.invoiceIds = [invoice.id];
      else if (mode === "pick" && picked.size) body.invoiceIds = [...picked];
      const p = await api.post<Payment>("/portal/invoicing/api/payments", body);
      invalidate("/portal/invoicing/api/invoices", "/portal/invoicing/api/payments", "/portal/invoicing/api/customers", "/portal/invoicing/api/activity", SUMMARY_KEY);
      toast.good(`${money(cents)} recorded`);
      onDone?.(p);
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const cents = inputToCents(amount) ?? 0;
  const over = invoice && cents > invoice.balanceCents ? cents - invoice.balanceCents : 0;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Record a payment"
      description={invoice ? `For ${invoice.number}, ${invoice.customerName}` : "A cheque, cash, or anything Settled did not see arrive."}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} busy={busy} icon={<Check />}>
            Record {cents ? money(cents) : "payment"}
          </Button>
        </>
      }
    >
      <div className="stack">
        {!invoice ? (
          <Field label="Who paid">
            <CustomerPicker value={customer?.id ?? null} onChange={setCustomer} />
          </Field>
        ) : null}
        <div className="row-fields">
          <Field label="Amount" htmlFor="rp-amt" hint={over ? `${money(over)} more than owed. It stays as credit for their next invoice.` : undefined}>
            <div className="input-wrap">
              <span className="input-prefix">$</span>
              <input id="rp-amt" className="input num" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" data-autofocus />
            </div>
          </Field>
          <Field label="Received" htmlFor="rp-date">
            <input id="rp-date" type="date" className="input" value={receivedOn} onChange={(e) => setReceivedOn(e.target.value)} />
          </Field>
        </div>
        <div className="field">
          <span className="label" id="rp-method">
            How they paid
          </span>
          <div className="method-grid" role="radiogroup" aria-labelledby="rp-method">
            {METHODS.map((m) => (
              <button key={m.value} type="button" role="radio" aria-checked={method === m.value} className="method-opt" onClick={() => setMethod(m.value)}>
                <MethodIcon method={m.value} />
                {m.label}
              </button>
            ))}
          </div>
        </div>
        <Field label="Reference" htmlFor="rp-ref" hint="Cheque number or anything that helps you find it later. Optional.">
          <input id="rp-ref" className="input" value={reference} onChange={(e) => setReference(e.target.value)} />
        </Field>
        {!invoice && cid ? (
          <div className="field">
            <span className="label">Put it on</span>
            <div className="seg" role="radiogroup">
              <button type="button" role="radio" aria-checked={mode === "auto"} onClick={() => setMode("auto")}>
                Let Settled decide
              </button>
              <button type="button" role="radio" aria-checked={mode === "pick"} onClick={() => setMode("pick")}>
                Choose invoices
              </button>
            </div>
            {mode === "auto" ? (
              <span className="hint">An invoice with exactly this balance first, otherwise the oldest. Anything left becomes credit.</span>
            ) : (
              <div className="pick-list">
                {(openInv.data?.invoices ?? []).length === 0 ? (
                  <span className="hint">{openInv.data ? "Nothing open for this customer. It will be kept as credit." : "Loading…"}</span>
                ) : (
                  openInv.data!.invoices.map((i) => (
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
            )}
          </div>
        ) : null}
        {error ? (
          <div className="notice notice-danger" role="alert">
            {error}
          </div>
        ) : null}
      </div>
    </Dialog>
  );
}
