import { requireClient } from "@/lib/auth/session";
import { getAgency, getClient } from "@/lib/data/clients";
import { balance, listInvoices } from "@/lib/data/invoices";
import { listPayments } from "@/lib/data/payments";
import { lateFees, nextMonthly } from "@/lib/billing";
import { formatDate, formatMoney, today } from "@/lib/format";
import { Count, Delta, KitCard, KitHead, KitPill, KitTile } from "@/components/kit";
import { InvoiceTable } from "@/components/features/InvoiceTable";
import { BillingFaq } from "@/components/features/BillingFaq";

export const metadata = { title: "Billing" };

export default async function BillingPage() {
  const viewer = await requireClient();
  const [agency, client, invoices, payments] = await Promise.all([
    getAgency(viewer),
    getClient(viewer),
    listInvoices(viewer),
    listPayments(viewer),
  ]);
  const now = today();
  const b = balance(invoices, now, client.creditCents);
  const late = lateFees(b.open, now);
  const monthly = nextMonthly(now);
  const last = payments[0];

  return (
    <>
      <KitHead title="Billing" sub="What you owe, what you've paid, and every invoice." />
      <div className="k-grid">
        <KitCard
          c="forest"
          icon="bill"
          title="Your balance"
          sub={b.owing === 0 ? "You're all paid up. Thank you!" : b.overdueCount ? `${formatMoney(b.overdue)} past due` : b.nextDue ? `Next payment due ${formatDate(b.nextDue)}` : "Due now"}
          span="k-s8"
          still
        >
          <div className="k-tiles">
            <KitTile
              label="Balance left"
              delta={b.overdueCount ? <Delta dir="down">past due</Delta> : b.owing === 0 ? <span className="k-tile__d k-up">All paid up</span> : undefined}
            >
              <Count value={b.owing / 100} format="cents" />
            </KitTile>
            <KitTile label="Paid so far" delta={last ? <span className="k-tile__d k-flat">Last {formatMoney(last.amountCents)}, {formatDate(last.paidOn)}</span> : undefined}>
              <Count value={b.paid / 100} format="cents" />
            </KitTile>
            {client.monthlyCents ? (
              <KitTile label="Monthly" delta={<span className="k-tile__d k-flat">Next invoice {formatDate(monthly.invoiceOn)}, due {formatDate(monthly.dueOn)}</span>}>
                <Count value={client.monthlyCents / 100} format="cents" />
              </KitTile>
            ) : null}
          </div>
          {b.open.length > 0 && (
            <div className="k-rows">
              {b.open.map((i) => (
                <div className="k-row" key={i.number}>
                  <span className="k-dot" />
                  <div className="k-row__m">
                    <b>{i.description || `Invoice ${i.number}`}</b>
                    <small>
                      {i.number} · due {formatDate(i.dueOn)}
                    </small>
                  </div>
                  <div className="k-row__r">
                    {i.dueOn < now ? <KitPill tone="bad">Overdue</KitPill> : i.partPaid ? <KitPill tone="jay">Part paid</KitPill> : null}
                    <b>{formatMoney(i.leftCents)}</b>
                  </div>
                </div>
              ))}
            </div>
          )}
          {b.credit > 0 && <p className="k-note">You have a credit of {formatMoney(b.credit)}. It comes off your next invoice.</p>}
          {late.cents > 0 && (
            <p className="k-late">
              {formatMoney(late.cents)} is more than 30 days past due. Interest of 2% a month ({formatMoney(late.perMonthCents)}) can apply.
            </p>
          )}
          {b.owing > 0 && agency.paymentInstructions && (
            <p className="k-note">
              <strong>How to pay:</strong> {agency.paymentInstructions}
            </p>
          )}
        </KitCard>

        <KitCard c="jay" icon="history" title="Payments" sub="Every payment we've received" span="k-s4" still>
          {payments.length ? (
            <div className="k-rows">
              {payments.slice(0, 8).map((p) => (
                <div className="k-row" key={p.id}>
                  <div className="k-row__m">
                    <b>{formatMoney(p.amountCents)}</b>
                    <small>
                      {formatDate(p.paidOn)}
                      {p.note ? ` · ${p.note}` : ""}
                    </small>
                  </div>
                  <div className="k-row__r">
                    <KitPill tone="good">Received</KitPill>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="k-note">Payments show here as soon as we receive them.</p>
          )}
        </KitCard>

        <div className="k-s12 k-reveal">
          <InvoiceTable invoices={invoices} today={now} />
        </div>

        <BillingFaq monthlyCents={client.monthlyCents} />
      </div>
    </>
  );
}
