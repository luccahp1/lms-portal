import Link from "next/link";
import { dismissPaymentsAction } from "@/app/actions";
import { formatDate, formatMoney } from "@/lib/format";

/** "Payment received" for each payment the client has not dismissed yet. */
export function PaymentNotice({ payments }: { payments: { id: string; amountCents: number; paidOn: string }[] }) {
  if (payments.length === 0) return null;
  const total = payments.reduce((s, p) => s + p.amountCents, 0);
  return (
    <div className="k-notice" role="status">
      <div className="k-notice__m">
        <b>Payment received.</b>{" "}
        {payments.length === 1
          ? `We got your payment of ${formatMoney(total)} on ${formatDate(payments[0]!.paidOn)}. Thank you!`
          : `We got ${payments.length} payments totalling ${formatMoney(total)}. Thank you!`}
      </div>
      <Link className="k-btn k-btn--sm" href="/portal/billing">
        See billing
      </Link>
      <form action={dismissPaymentsAction}>
        {payments.map((p) => (
          <input key={p.id} type="hidden" name="id" value={p.id} />
        ))}
        <button type="submit" className="k-btn k-btn--sm k-btn--ghost">
          Dismiss
        </button>
      </form>
    </div>
  );
}
