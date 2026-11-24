"use client";

import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";
import { Bell, CircleCheck, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { CheckDraw, Num, ease, spring } from "@/settled/ui/motion";

type Phase = 0 | 1 | 2 | 3;
// 0: invoices waiting · 1: notice arrives · 2: incoming · 3: paid

const ROWS = [
  { n: "INV-1044", who: "Marcus Lee", amt: 107350, status: "viewed" },
  { n: "INV-1042", who: "Priya Shah", amt: 47460, status: "sent", hero: true },
  { n: "INV-1039", who: "Tom Barrett", amt: 25425, status: "overdue" },
];

const LABEL: Record<string, string> = { sent: "Sent", viewed: "Viewed", overdue: "Overdue", incoming: "Incoming", paid: "Paid" };

/**
 * The landing page's live demo: an Interac notice lands, the invoice goes
 * Incoming, then flips to Paid by itself and the month's total ticks up.
 * Loops while on screen. With reduced motion it shows the finished state.
 */
export function HeroDemo() {
  const reduce = useReducedMotion();
  const box = useRef<HTMLDivElement>(null);
  const inView = useInView(box, { margin: "-80px" });
  const [phase, setPhase] = useState<Phase>(reduce ? 3 : 0);
  const [loop, setLoop] = useState(0);

  useEffect(() => {
    if (reduce || !inView) return;
    const times = [1300, 2600, 3900, 8200];
    const ts = times.map((t, i) =>
      setTimeout(() => {
        if (i < 3) setPhase((i + 1) as Phase);
        else {
          setPhase(0);
          setLoop((l) => l + 1);
        }
      }, t),
    );
    return () => ts.forEach(clearTimeout);
  }, [reduce, inView, loop]);

  const heroStatus = phase >= 3 ? "paid" : phase >= 2 ? "incoming" : "sent";
  const month = 1268400 + (phase >= 3 ? 47460 : 0);

  return (
    <div className="demo" ref={box} aria-label="A short demo: an e-Transfer arrives and the invoice marks itself paid." role="img">
      <div className="demo-glow" aria-hidden />
      <AnimatePresence>
        {phase >= 1 && phase < 3 ? (
          <motion.div
            key={"note" + loop}
            className="demo-note"
            initial={{ opacity: 0, y: -24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.97, transition: { duration: 0.3 } }}
            transition={spring}
          >
            <span className="demo-note-ico">
              <Send />
            </span>
            <span className="grow">
              <span className="demo-note-from">INTERAC e-Transfer · now</span>
              <span className="demo-note-text">Priya Shah sent you $474.60</span>
              <span className="demo-note-msg">Message: INV-1042</span>
            </span>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="demo-app">
        <div className="demo-top">
          <div>
            <span className="demo-k">Paid this month</span>
            <span className="demo-big">
              <Num value={month} countUp={false} format="moneyShort" />
            </span>
          </div>
          <AnimatePresence>
            {phase >= 3 ? (
              <motion.span key={"up" + loop} className="demo-up" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                +$474.60
              </motion.span>
            ) : null}
          </AnimatePresence>
        </div>
        <ul className="demo-rows">
          {ROWS.map((r) => {
            const st = r.hero ? heroStatus : r.status;
            const flip = r.hero && phase >= 3;
            return (
              <li key={r.n} className={"demo-row" + (flip ? " flip" : "")}>
                <span className="grow">
                  <span className="demo-n">{r.n}</span>
                  <span className="demo-who">{r.who}</span>
                </span>
                <motion.span layout transition={spring} className={"pill" + (st === "incoming" ? " pill-incoming" : "") + (flip ? " paid-glow" : "")} data-s={st}>
                  {st === "paid" ? <CheckDraw key={"c" + loop} size={13} /> : <span className="pill-dot" />}
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.span key={st} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2, ease }}>
                      {LABEL[st]}
                    </motion.span>
                  </AnimatePresence>
                </motion.span>
                <span className="demo-amt num">${(r.amt / 100).toLocaleString("en-CA", { minimumFractionDigits: 2 })}</span>
              </li>
            );
          })}
        </ul>
      </div>

      <AnimatePresence>
        {phase >= 3 ? (
          <motion.div key={"toast" + loop} className="demo-toast" initial={{ opacity: 0, y: 14, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8 }} transition={{ ...spring, delay: 0.35 }}>
            <CircleCheck />
            <span>Priya Shah paid INV-1042. Receipt sent.</span>
          </motion.div>
        ) : phase === 0 ? (
          <motion.div key={"rem" + loop} className="demo-toast muted-toast" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Bell />
            <span>Reminder for INV-1039 sent this morning</span>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
