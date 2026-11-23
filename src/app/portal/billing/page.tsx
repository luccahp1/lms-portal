import { requireClient } from "@/lib/auth/session";
import { getAgency, getClient } from "@/lib/data/clients";
import { balance, listInvoices } from "@/lib/data/invoices";
import { listPayments } from "@/lib/data/payments";
import { clientPayState, confirmReturn, markInvoicesViewed, type CheckoutOutcome } from "@/lib/data/online-pay";
import { lateFees, nextMonthly } from "@/lib/billing";
import { formatDate, formatMoney, today } from "@/lib/format";
import { Count, Delta, KitCard, KitHead, KitPill, KitTile } from "@/components/kit";
import { InvoiceTable } from "@/components/features/InvoiceTable";
import { BillingFaq } from "@/components/features/BillingFaq";

export const metadata = { title: "Billing" };

/** Why the Pay button sent them back (src/lib/pay.ts). */
const PAY_ERRORS: Record<string, string> = {
  preview: "This is a preview. Clients pay from their own login.",
  paid: "That invoice is already paid.",
  busy: "A payment for this is already on its way, so there's nothing to pay again.",
  nothing: "There's nothing to pay right now.",
  off: "Paying online isn't available right now.",
  failed: "The payment page didn't open. Please try again in a minute.",
};

const RETURNED: Partial<Record<CheckoutOutcome, string>> = {
  paid: "Thank you, your payment went through. It shows as received here, and your balance updates once we've applied it.",
  processing: "Thank you. Your bank debit is on its way. It takes a few business days to clear, and we'll mark it paid when it does.",
  held: "Thank you, we received your payment. We'll be in touch about it.",
};

const PENDING_LABEL: Record<string, string> = { processing: "Bank debit clearing", paid: "Received, processing", held: "Received" };

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ session?: string; error?: string }> }) {
  const viewer = await requireClient();
  const params = await searchParams;
  // Back from Stripe's page: ask Stripe about it before drawing, so a missing webhook costs nothing.
  const returned = params.session ? await confirmReturn(viewer, params.session) : null;
  await markInvoicesViewed(viewer);
  const [agency, client, invoices, payments, pay] = await Promise.all([
    getAgency(viewer),
    getClient(viewer),
    listInvoices(viewer),
    listPayments(viewer),
    clientPayState(viewer),
  ]);
  const covered = new Set(pay.covered);
  const canPay = pay.ready;
  const payError = params.error ? PAY_ERRORS[params.error] : undefined;
  const thanks = returned ? RETURNED[returned] : undefined;
  const now = today();
  const b = balance(invoices, now, client.creditCents);
  const late = lateFees(b.open, now);
  const monthly = nextMonthly(now);
  const last = payments[0];

  return (
    <>
      <KitHead title="Billing" sub="What you owe, what you've paid, and every invoice." />
      {thanks && (
        <div className="k-notice" role="status">
          <div className="k-notice__m">{thanks}</div>
        </div>
      )}
      {payError && (
        <p className="k-late mb-4" role="alert">
          {payError}
        </p>
      )}
      {pay.failed.map((f) => (
        <p className="k-late mb-4" role="alert" key={f.id}>
          Your bank debit of {formatMoney(f.amountCents)} didn&apos;t go through, so it hasn&apos;t been paid. You can pay again below.
        </p>
      ))}
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
                <div className="k-row flex-wrap sm:flex-nowrap" key={i.number}>
                  <span className="k-dot" />
                  <div className="k-row__m">
                    <b>{i.description || `Invoice ${i.number}`}</b>
                    <small>
                      {i.number} · due {formatDate(i.dueOn)}
                    </small>
                  </div>
                  <div className="k-row__r">
                    {covered.has(i.number) ? (
                      <KitPill tone="jay">Processing</KitPill>
                    ) : i.dueOn < now ? (
                      <KitPill tone="bad">Overdue</KitPill>
                    ) : i.partPaid ? (
                      <KitPill tone="jay">Part paid</KitPill>
                    ) : null}
                    <b>{formatMoney(i.leftCents)}</b>
                  </div>
                  {canPay && !covered.has(i.number) && (
                    // Its own full-width line on a phone, so the invoice name keeps its room.
                    <form action="/portal/billing/pay" method="post" className="w-full sm:w-auto">
                      <input type="hidden" name="invoice" value={i.number} />
                      <button type="submit" className="k-btn k-btn--sm w-full sm:w-auto" aria-label={`Pay invoice ${i.number}, ${formatMoney(i.leftCents)}`}>
                        Pay<span className="sm:hidden">&nbsp;{formatMoney(i.leftCents)}</span>
                      </button>
                    </form>
                  )}
                </div>
              ))}
            </div>
          )}
          {canPay && b.open.length > 1 && !pay.balanceBusy && (
            <form action="/portal/billing/pay" method="post" className="k-acts mt-3">
              <input type="hidden" name="all" value="1" />
              <button type="submit" className="k-btn k-btn--pri">
                Pay full balance, {formatMoney(b.owing)}
              </button>
            </form>
          )}
          {canPay && b.owing > 0 && (
            <p className="k-note mt-2">
              Pay by card, Apple Pay, Google Pay or bank debit (pre-authorized debit from a Canadian bank account) on Stripe&apos;s secure page.
              {pay.testMode && <strong> Test mode: only Stripe test cards work, and no money moves.</strong>}
            </p>
          )}
          {b.credit > 0 && <p className="k-note">You have a credit of {formatMoney(b.credit)}. It comes off your next invoice.</p>}
          {late.cents > 0 && (
            <p className="k-late">
              {formatMoney(late.cents)} is more than 30 days past due. Interest of 2% a month ({formatMoney(late.perMonthCents)}) can apply.
            </p>
          )}
          {b.owing > 0 && agency.paymentInstructions && (
            <p className="k-note">
              <strong>{canPay ? "Or pay another way:" : "How to pay:"}</strong> {agency.paymentInstructions}
            </p>
          )}
        </KitCard>

        <KitCard c="jay" icon="history" title="Payments" sub="Every payment we've received" span="k-s4" still>
          {payments.length || pay.pending.length ? (
            <div className="k-rows">
              {pay.pending.map((p) => (
                <div className="k-row" key={p.id}>
                  <div className="k-row__m">
                    <b>{formatMoney(p.amountCents)}</b>
                    <small>
                      {formatDate(p.paidOn ?? new Date(p.createdAt))} · {p.method || "Online"}
                      {p.kind === "invoice" ? ` · ${p.invoiceNumbers[0]}` : " · Full balance"}
                    </small>
                  </div>
                  <div className="k-row__r">
                    <KitPill tone="jay">{PENDING_LABEL[p.status] ?? "Processing"}</KitPill>
                  </div>
                </div>
              ))}
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
          <InvoiceTable invoices={invoices} today={now} processing={pay.covered} />
        </div>

        <BillingFaq monthlyCents={client.monthlyCents} />
      </div>
    </>
  );
}
