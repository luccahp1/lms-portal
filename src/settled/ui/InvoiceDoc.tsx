/* A clean on-screen invoice. Used in the app, on the customer's pay page and in the branding preview. */

import { dayLong, money } from "@/settled/lib/format";
import type { LineItem } from "@/settled/lib/types";
import { Num } from "@/settled/ui/motion";

export interface DocBusiness {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  website?: string;
  logo?: string;
  brandColor?: string;
  taxLabel?: string;
  taxRate?: number;
  taxNumber?: string;
  footer?: string;
}

export interface DocInvoice {
  number: string;
  issuedOn: string | null;
  dueOn: string | null;
  currency: string;
  items: LineItem[];
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  paidCents: number;
  balanceCents: number;
  notes?: string;
}

export function InvoiceDoc({
  business,
  customer,
  invoice,
  animateBalance,
  stamp,
}: {
  business: DocBusiness;
  customer: { name: string; company?: string; email?: string; address?: string };
  invoice: DocInvoice;
  animateBalance?: boolean;
  stamp?: React.ReactNode;
}) {
  const brand = business.brandColor || "#0d5f4e";
  const cur = invoice.currency;
  return (
    <article className="doc" style={{ ["--brand" as string]: brand }} aria-label={`Invoice ${invoice.number}`}>
      <div className="doc-band" aria-hidden />
      {stamp}
      <header className="doc-head">
        <div className="doc-from">
          {business.logo ? (
            // A data: URL the business uploaded; next/image cannot optimize those.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={business.logo} alt={business.name} className="doc-logo" />
          ) : (
            <span className="doc-name">{business.name}</span>
          )}
          <span className="doc-small">
            {[business.address, business.phone, business.email, business.website].filter(Boolean).map((l, i) => (
              <span key={i} style={{ display: "block", whiteSpace: "pre-line" }}>
                {l}
              </span>
            ))}
          </span>
        </div>
        <div className="doc-title">
          <span className="doc-kicker">Invoice</span>
          <span className="doc-number">{invoice.number}</span>
        </div>
      </header>

      <section className="doc-meta">
        <div>
          <span className="doc-label">Billed to</span>
          <span className="doc-strong">{customer.name}</span>
          {customer.company && customer.company !== customer.name ? <span className="doc-small">{customer.company}</span> : null}
          {customer.address ? <span className="doc-small" style={{ whiteSpace: "pre-line" }}>{customer.address}</span> : null}
          {customer.email ? <span className="doc-small">{customer.email}</span> : null}
        </div>
        <div>
          <span className="doc-label">Issued</span>
          <span>{dayLong(invoice.issuedOn) || "Not sent yet"}</span>
        </div>
        <div>
          <span className="doc-label">Due</span>
          <span>{invoice.dueOn ? dayLong(invoice.dueOn) : "On receipt"}</span>
        </div>
      </section>

      <table className="doc-items">
        <thead>
          <tr>
            <th>Description</th>
            <th className="r hide-xs">Qty</th>
            <th className="r hide-xs">Price</th>
            <th className="r">Amount</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items.map((it, i) => (
            <tr key={i}>
              <td>
                {it.description || <span className="faint">No description</span>}
                <span className="doc-xs-qty">
                  {it.quantity} × {money(it.unitCents, cur)}
                </span>
                {!it.taxable && (business.taxRate ?? 0) > 0 ? <span className="doc-notax">No {business.taxLabel || "tax"}</span> : null}
              </td>
              <td className="r num hide-xs">{it.quantity}</td>
              <td className="r num hide-xs">{money(it.unitCents, cur)}</td>
              <td className="r num">{money(it.amountCents, cur)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <section className="doc-totals">
        <div>
          <span>Subtotal</span>
          <span className="num">{money(invoice.subtotalCents, cur)}</span>
        </div>
        {invoice.taxCents > 0 || (business.taxRate ?? 0) > 0 ? (
          <div>
            <span>
              {business.taxLabel || "Tax"}
              {business.taxRate ? ` (${business.taxRate}%)` : ""}
            </span>
            <span className="num">{money(invoice.taxCents, cur)}</span>
          </div>
        ) : null}
        <div className="doc-total">
          <span>Total</span>
          <span className="num">{money(invoice.totalCents, cur)}</span>
        </div>
        {invoice.paidCents > 0 ? (
          <div>
            <span>Paid</span>
            <span className="num">−{money(invoice.paidCents, cur)}</span>
          </div>
        ) : null}
        <div className="doc-balance">
          <span>Balance due</span>
          {animateBalance ? <Num value={invoice.balanceCents} currency={cur} countUp={false} /> : <span className="num">{money(invoice.balanceCents, cur)}</span>}
        </div>
      </section>

      {invoice.notes ? <p className="doc-notes">{invoice.notes}</p> : null}
      <footer className="doc-foot">
        {business.taxNumber ? (
          <span>
            {business.taxLabel || "Tax"} number {business.taxNumber}
          </span>
        ) : null}
        {business.footer ? <span>{business.footer}</span> : null}
      </footer>
    </article>
  );
}
