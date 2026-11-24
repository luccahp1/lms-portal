"use client";

import { motion } from "motion/react";
import { Ban, Check, Clock3, XCircle } from "lucide-react";
import type { EtStatus } from "@/settled/lib/types";
import { ease } from "@/settled/ui/motion";

const ORDER = ["pending", "processing", "deposited"] as const;
const LABELS = ["Sent", "Accepted", "Deposited"];
const END: Record<string, string> = {
  cancelled: "Cancelled by the sender",
  declined: "Declined",
  expired: "Expired before it was accepted",
  failed: "The bank could not deposit it",
};

/** Where an e-Transfer is: Sent, Accepted (waiting on the bank), Deposited; or how it ended. */
export function EtTrack({ status }: { status: EtStatus | "" }) {
  if (!status) return null;
  if (status in END) {
    return (
      <div className="et-end" role="status">
        {status === "cancelled" || status === "declined" ? <Ban /> : <XCircle />}
        <span>{END[status]}. The money never arrived.</span>
      </div>
    );
  }
  const at = ORDER.indexOf(status as (typeof ORDER)[number]);
  const pct = at <= 0 ? 0 : at === 1 ? 50 : 100;
  return (
    <div className="et" role="img" aria-label={`e-Transfer: ${LABELS[at]}${at === 1 ? ", waiting on the bank" : at === 0 ? ", waiting to be accepted" : ""}`}>
      <div className="et-rail">
        <motion.span className="et-fill" initial={{ width: 0 }} animate={{ width: pct + "%" }} transition={{ duration: 0.6, ease }} />
      </div>
      <div className="et-steps">
        {LABELS.map((l, i) => (
          <span key={l} className={"et-step" + (i <= at ? " on" : "") + (i === at && at < 2 ? " now" : "")}>
            <span className="et-dot">{i < at || at === 2 ? <Check /> : i === at ? <Clock3 /> : null}</span>
            <span className="et-label">{i === 1 && at === 1 ? "Accepted, waiting on the bank" : l}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
