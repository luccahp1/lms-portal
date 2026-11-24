"use client";

import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { ArrowRight, Bell, Check, CreditCard, FileText, Hourglass, Inbox, Landmark, Lock, Repeat, Send, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { askForInvoicing } from "@/app/portal/invoicing/actions";
import { HeroDemo } from "@/settled/ui/HeroDemo";
import { CheckDraw, ease, rise, spring, stagger } from "@/settled/ui/motion";

/*
  What a client sees under Invoicing before the add-on is on: what it does, a live demo of an
  invoice marking itself paid, and one button that asks LMS to switch it on (a portal request).
*/

const STEPS = [
  { icon: Send, title: "Send the invoice", body: "Pick a customer, add what you did, press Send. They get a PDF and a pay link." },
  { icon: CreditCard, title: "They pay however they like", body: "Interac e-Transfer, card, Apple Pay, Google Pay or bank debit. No account needed." },
  { icon: ShieldCheck, title: "It marks itself paid", body: "Settled reads the payment, checks it's genuine, finds the invoice and marks it Paid." },
];

const FEATURES = [
  { icon: Landmark, title: "e-Transfers matched by themselves", body: "From your Gmail or forwarded emails. Any Canadian bank." },
  { icon: Inbox, title: "A small inbox that learns", body: "Not sure who sent it? One tap, and it remembers that payer." },
  { icon: Bell, title: "Reminders that stop when they pay", body: "Polite emails before and after the due date, and never after." },
  { icon: FileText, title: "Cheques and cash too", body: "Upload a bank statement; nothing is counted twice." },
  { icon: Repeat, title: "Recurring invoices", body: "Monthly work bills itself. Overpayments become credit." },
  { icon: Sparkles, title: "Who owes what, at a glance", body: "Outstanding, overdue and what's coming in this week." },
];

export function Locked({ enabled, preview }: { enabled: boolean; preview: boolean }) {
  const [state, setState] = useState<"idle" | "sent" | "already" | "error">("idle");
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();

  const ask = () =>
    start(async () => {
      try {
        const r = await askForInvoicing();
        if (!r.ok) {
          setState("error");
          setMessage(r.message || "That didn't go through. Please try again.");
        } else setState(r.already ? "already" : "sent");
      } catch {
        setState("error");
        setMessage("That didn't go through. Please try again, or send us a message.");
      }
    });

  return (
    <MotionConfig reducedMotion="user">
      <div className="stl lock">
        <motion.div variants={stagger(0.06)} initial="hidden" animate="show">
          <motion.section variants={rise} className="card lock-hero">
            <div className="lock-copy">
              <span className="lock-kicker">
                {enabled ? <Hourglass /> : <Lock />} {enabled ? "Getting it ready" : "Add-on"}
              </span>
              <h1>Invoices that know when they&apos;re paid</h1>
              <p className="lock-lede">
                Send an invoice in seconds. When the e-Transfer lands, Settled marks it paid by itself. No more scrolling the bank app, no more &ldquo;did you pay?&rdquo; texts.
              </p>
              {enabled ? (
                <div className="notice notice-good" style={{ marginTop: 22 }}>
                  <Hourglass />
                  <span>Invoicing is switched on for you and is being set up. It will open here shortly.</span>
                </div>
              ) : (
                <div className="lock-cta">
                  <AnimatePresence mode="wait" initial={false}>
                    {state === "sent" || state === "already" ? (
                      <motion.div key="done" className="lock-sent" initial={{ opacity: 0, y: 8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={spring} role="status">
                        <span className="lock-sent-ico">
                          <CheckDraw size={18} stroke={3} />
                        </span>
                        <span>
                          <strong>{state === "sent" ? "Request sent." : "You've already asked."}</strong> We&apos;ll be in touch to switch it on.{" "}
                          <Link className="link" href="/portal/requests">
                            See your requests
                          </Link>
                        </span>
                      </motion.div>
                    ) : (
                      <motion.div key="ask" exit={{ opacity: 0, y: -6 }} className="hstack wrap" style={{ gap: 12 }}>
                        <button type="button" className="btn btn-primary btn-lg" onClick={ask} disabled={pending || preview}>
                          {pending ? "Sending…" : "Ask us to switch it on"} <ArrowRight />
                        </button>
                        <span className="small muted">{preview ? "Preview: clients ask from their own login." : "Added to your plan. We set it up with you."}</span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  {state === "error" ? (
                    <div className="notice notice-danger" role="alert" style={{ marginTop: 12 }}>
                      {message}
                    </div>
                  ) : null}
                </div>
              )}
              <ul className="lock-trust">
                {["Your money never touches us", "Customers don't need an account", "Any Canadian bank"].map((t) => (
                  <li key={t}>
                    <Check /> {t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="lock-demo">
              <HeroDemo />
            </div>
          </motion.section>

          <motion.h2 variants={rise} className="lock-h2">
            Three steps, and you only do the first one
          </motion.h2>
          <motion.ol variants={stagger(0.08)} className="lock-steps">
            {STEPS.map((s, i) => (
              <motion.li key={s.title} variants={rise} className="card lock-step">
                <span className="lock-step-n">{i + 1}</span>
                <span className="lock-step-ico">
                  <s.icon />
                </span>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </motion.li>
            ))}
          </motion.ol>

          <motion.div variants={stagger(0.05)} className="lock-grid">
            {FEATURES.map((f) => (
              <motion.div key={f.title} variants={rise} className="card lock-feat" whileHover={{ y: -2 }} transition={{ duration: 0.2, ease }}>
                <span className="lock-feat-ico">
                  <f.icon />
                </span>
                <div>
                  <h3>{f.title}</h3>
                  <p>{f.body}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </div>
    </MotionConfig>
  );
}
