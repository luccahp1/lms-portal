"use client";

import { AnimatePresence, motion } from "motion/react";
import {
  AlertTriangle, Ban, Bell, CircleCheck, CircleDollarSign, Clock, Eye, FilePen, FilePlus, Hourglass, Inbox, MailWarning, Repeat,
  Send, Settings2, Trash2, UserPlus, XCircle,
} from "lucide-react";
import Link from "next/link";
import { ago } from "@/settled/lib/format";
import type { ActivityEvent } from "@/settled/lib/types";
import { CheckDraw, spring } from "@/settled/ui/motion";

const KIND: Record<string, { icon: React.ReactNode; color: string }> = {
  "invoice.created": { icon: <FilePlus />, color: "var(--st-draft)" },
  "invoice.sent": { icon: <Send />, color: "var(--st-sent)" },
  "invoice.viewed": { icon: <Eye />, color: "var(--st-viewed)" },
  "invoice.reminded": { icon: <Bell />, color: "var(--st-partial)" },
  "invoice.paid": { icon: <CircleCheck />, color: "var(--st-paid)" },
  "invoice.partially_paid": { icon: <CircleDollarSign />, color: "var(--st-partial)" },
  "invoice.voided": { icon: <Ban />, color: "var(--st-void)" },
  "invoice.updated": { icon: <FilePen />, color: "var(--st-draft)" },
  "payment.recorded": { icon: <CircleDollarSign />, color: "var(--st-paid)" },
  "payment.removed": { icon: <Trash2 />, color: "var(--st-void)" },
  "payment.clearing": { icon: <Hourglass />, color: "var(--st-incoming)" },
  "payment.failed": { icon: <XCircle />, color: "var(--st-overdue)" },
  "deposit.received": { icon: <Inbox />, color: "var(--st-incoming)" },
  "deposit.matched": { icon: <CircleCheck />, color: "var(--st-paid)" },
  "deposit.needs_review": { icon: <Clock />, color: "var(--st-partial)" },
  "deposit.failed": { icon: <AlertTriangle />, color: "var(--st-overdue)" },
  "deposit.dismissed": { icon: <Ban />, color: "var(--st-void)" },
  "customer.created": { icon: <UserPlus />, color: "var(--st-sent)" },
  "recurring.generated": { icon: <Repeat />, color: "var(--st-viewed)" },
  "email.failed": { icon: <MailWarning />, color: "var(--st-overdue)" },
  "setup.changed": { icon: <Settings2 />, color: "var(--st-draft)" },
};

function hrefFor(e: ActivityEvent): string | null {
  if (e.kind.startsWith("deposit.") && (e.kind === "deposit.needs_review" || e.kind === "deposit.received")) return "/portal/invoicing/inbox";
  if (e.invoiceId) return "/portal/invoicing/invoices/" + e.invoiceId;
  if (e.customerId) return "/portal/invoicing/customers/" + e.customerId;
  if (e.paymentId) return "/portal/invoicing/payments";
  return null;
}

export function FeedItem({ e, fresh }: { e: ActivityEvent; fresh?: boolean }) {
  const k = KIND[e.kind] ?? { icon: <Clock />, color: "var(--text-3)" };
  const paid = e.kind === "invoice.paid" || e.kind === "deposit.matched";
  const href = hrefFor(e);
  const inner = (
    <>
      <span className={"ico" + (fresh && paid ? " paid-glow" : "")} style={{ ["--ic" as string]: k.color }}>
        {fresh && paid ? <CheckDraw size={16} stroke={2.6} /> : k.icon}
      </span>
      <span className="grow">
        <span className="feed-text">{e.summary}</span>
        <span className="tiny faint">{ago(e.at)}</span>
      </span>
    </>
  );
  return href ? (
    <Link href={href} className="feed-item">
      {inner}
    </Link>
  ) : (
    <div className="feed-item">{inner}</div>
  );
}

/** A feed where new events slide in at the top; `freshIds` get the paid treatment. */
export function Feed({ events, freshIds, limit = 12 }: { events: ActivityEvent[]; freshIds?: Set<string>; limit?: number }) {
  return (
    <ol className="feed">
      <AnimatePresence initial={false}>
        {events.slice(0, limit).map((e) => (
          <motion.li
            key={e.id}
            layout="position"
            initial={{ opacity: 0, y: -14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={spring}
          >
            <FeedItem e={e} fresh={freshIds?.has(e.id)} />
          </motion.li>
        ))}
      </AnimatePresence>
    </ol>
  );
}
