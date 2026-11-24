"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRight, ChevronDown, FilePlus, PartyPopper, UserPlus } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { api, errorMessage } from "@/settled/lib/api";
import { plural } from "@/settled/lib/format";
import { invalidate, useResource } from "@/settled/lib/hooks";
import type { ImportResult, SettingsOut, SetupInfo, SetupStep } from "@/settled/lib/types";
import { CheckDraw, Num, ProgressRing, ease, spring } from "@/settled/ui/motion";
import { ButtonLink, ErrorState, PageHead, Sk } from "@/settled/ui/ui";
import { EtransferAuto, StripeConnect, type AutoData } from "@/settled/parts/connect";
import { DropZone } from "@/settled/parts/DropZone";
import { BrandingForm, EtransferForm, ProfileForm, RemindersForm, TaxForm } from "@/settled/parts/forms";
import { ME_KEY, SUMMARY_KEY } from "@/settled/shell/Frame";

const SETUP_KEY = "/portal/invoicing/api/setup";
const SETTINGS_KEY = "/portal/invoicing/api/settings";

export default function SetupPage() {
  const [open, setOpen] = useState<string | null>(null);
  const setup = useResource<SetupInfo>(SETUP_KEY, { poll: open === "etransfer_auto" ? 5_000 : undefined });
  const settings = useResource<SettingsOut>(SETTINGS_KEY);
  const [celebrate, setCelebrate] = useState(false);
  const prevPct = useRef<number | null>(null);
  const prevDone = useRef<Set<string> | null>(null);
  const [justDone, setJustDone] = useState<Set<string>>(new Set());

  const data = setup.data;

  // First load: open the first step that isn't done.
  useEffect(() => {
    if (data && open === null) setOpen(data.steps.find((s) => !s.done)?.id ?? "");
  }, [data, open]);

  // A step that just ticked: play its check and move on to the next one.
  useEffect(() => {
    if (!data) return;
    const done = new Set<string>(data.steps.filter((s) => s.done).map((s) => s.id));
    if (prevDone.current) {
      const fresh = [...done].filter((id) => !prevDone.current!.has(id));
      if (fresh.length) {
        setJustDone(new Set(fresh));
        if (open && (fresh as string[]).includes(open)) {
          const next = data.steps.find((s) => !s.done && s.id !== open);
          setTimeout(() => setOpen(next?.id ?? ""), 650);
        }
      }
    }
    prevDone.current = done;
    if (prevPct.current !== null && prevPct.current < 100 && data.percent === 100) setCelebrate(true);
    prevPct.current = data.percent;
  }, [data, open]);

  const refresh = () => {
    setup.reload();
    settings.reload();
    invalidate(ME_KEY, SUMMARY_KEY);
  };

  if (setup.error && !data) return <ErrorState message={setup.error} onRetry={setup.reload} />;

  const needed = data?.steps.filter((s) => !s.optional) ?? [];
  const doneCount = needed.filter((s) => s.done).length;

  return (
    <>
      <PageHead title="Setup" sub="About ten minutes. Then Settled runs by itself." />

      <section className={"card card-pad setup-hero" + (celebrate ? " paid-glow" : "")}>
        <ProgressRing value={(data?.percent ?? 0) / 100} size={96} stroke={9}>
          <span className="setup-pct">
            {data ? <Num value={data.percent} format="int" countUp={false} /> : "–"}
            <span className="small">%</span>
          </span>
        </ProgressRing>
        <div className="grow">
          <AnimatePresence mode="wait">
            {data?.percent === 100 ? (
              <motion.div key="done" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                <h2 className="setup-h">You&apos;re all set</h2>
                <p className="muted">Invoices go out, payments mark themselves, reminders handle the chasing. Go send something.</p>
                <div className="hstack wrap" style={{ marginTop: 14 }}>
                  <ButtonLink href="/portal/invoicing/invoices/new" variant="primary" icon={<FilePlus />}>
                    New invoice
                  </ButtonLink>
                  <ButtonLink href="/portal/invoicing" icon={<ArrowRight />}>
                    Overview
                  </ButtonLink>
                </div>
              </motion.div>
            ) : (
              <motion.div key="todo" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <h2 className="setup-h">{data ? `${doneCount} of ${needed.length} done` : " "}</h2>
                <p className="muted">Each step finishes right here. The optional ones you can do any time.</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {celebrate ? <Confetti onDone={() => setCelebrate(false)} /> : null}
      </section>

      <div className="steps">
        {!data || !settings.data
          ? Array.from({ length: 6 }).map((_, i) => <Sk key={i} h={72} r={16} />)
          : data.steps.map((st, i) => (
              <Step key={st.id} step={st} index={i} open={open === st.id} justDone={justDone.has(st.id)} onToggle={() => setOpen(open === st.id ? "" : st.id)}>
                <StepBody step={st} s={settings.data!} onSaved={refresh} />
              </Step>
            ))}
      </div>
    </>
  );
}

function Step({ step, index, open, justDone, onToggle, children }: { step: SetupStep; index: number; open: boolean; justDone: boolean; onToggle: () => void; children: React.ReactNode }) {
  const id = "step-" + step.id;
  return (
    <motion.section
      layout
      className={"card step" + (open ? " open" : "") + (step.done ? " done" : "")}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...spring, delay: index * 0.035 }}
    >
      <motion.button layout="position" type="button" className="step-head" onClick={onToggle} aria-expanded={open} aria-controls={id}>
        <span className={"step-tick" + (step.done ? " on" : "")}>
          <AnimatePresence initial={false}>
            {step.done ? (
              <motion.span key="t" initial={justDone ? { scale: 0.4 } : false} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 18 }} style={{ display: "grid" }}>
                <CheckDraw size={15} stroke={3} play={justDone} />
              </motion.span>
            ) : (
              <span className="step-n">{index + 1}</span>
            )}
          </AnimatePresence>
        </span>
        <span className="grow" style={{ textAlign: "left", minWidth: 0 }}>
          <span className="step-title">
            {step.title}
            {step.optional ? <span className="step-opt">Optional</span> : null}
          </span>
          <span className="step-why">{step.why}</span>
        </span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={spring} className="step-chev">
          <ChevronDown />
        </motion.span>
      </motion.button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div id={id} key="body" className="step-body" initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { delay: 0.08, duration: 0.25 } }} exit={{ opacity: 0, transition: { duration: 0.1 } }}>
            {children}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.section>
  );
}

function StepBody({ step, s, onSaved }: { step: SetupStep; s: SettingsOut; onSaved: () => void }) {
  const st = s.settings;
  switch (step.id) {
    case "profile":
      return <ProfileForm s={st} onSaved={onSaved} compact />;
    case "branding":
      return <BrandingForm s={st} onSaved={onSaved} />;
    case "tax":
      return <TaxForm s={st} onSaved={onSaved} />;
    case "etransfer":
      return <EtransferForm s={st} onSaved={onSaved} />;
    case "etransfer_auto":
      return <EtransferAuto data={step.data as unknown as AutoData} onChanged={onSaved} />;
    case "stripe":
      return <StripeConnect connected={s.connected.stripe} testMode={s.connected.stripeTestMode} onChanged={onSaved} />;
    case "customers":
      return <ImportStep kind="customers" onSaved={onSaved} />;
    case "first_invoice":
      return <ImportStep kind="invoices" onSaved={onSaved} />;
    case "reminders":
      return <RemindersForm s={st} onSaved={onSaved} />;
    default:
      return null;
  }
}

function ImportStep({ kind, onSaved }: { kind: "customers" | "invoices"; onSaved: () => void }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const upload = async (f: File) => {
    setBusy(true);
    setError(null);
    try {
      const r = await api.post<ImportResult>(`/portal/invoicing/api/imports/${kind}`, f, { contentType: "text/csv" });
      setResult(r);
      invalidate("/portal/invoicing/api/customers", "/portal/invoicing/api/invoices", SUMMARY_KEY);
      onSaved();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="stack">
      <div className="hstack wrap">
        {kind === "customers" ? (
          <ButtonLink href="/portal/invoicing/customers?new=1" variant="primary" icon={<UserPlus />}>
            Add one by hand
          </ButtonLink>
        ) : (
          <ButtonLink href="/portal/invoicing/invoices/new" variant="primary" icon={<FilePlus />}>
            Create an invoice
          </ButtonLink>
        )}
        <span className="small faint">or import a CSV</span>
      </div>
      <DropZone
        onFile={upload}
        busy={busy}
        title={kind === "customers" ? "Drop a customer list" : "Drop your unpaid invoices"}
        hint={kind === "customers" ? "From QuickBooks, Wave, FreshBooks, Xero or a spreadsheet. Name and email columns are enough." : "Number, customer, amount and due date. Settled watches for their money too."}
      />
      <AnimatePresence>
        {result ? (
          <motion.div className="notice notice-good" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} role="status">
            <PartyPopper />
            <span>
              Added {plural(result.created, kind === "customers" ? "customer" : "invoice")}
              {result.skipped ? `, skipped ${result.skipped}` : ""}.
              {result.problems.length ? <span className="tiny" style={{ display: "block", marginTop: 4 }}>{result.problems.slice(0, 3).join(" · ")}</span> : null}
            </span>
          </motion.div>
        ) : null}
      </AnimatePresence>
      {error ? (
        <div className="notice notice-danger" role="alert">
          {error}
        </div>
      ) : null}
      {kind === "customers" ? null : (
        <Link className="link small" href="/portal/invoicing/recurring">
          Bill someone the same thing every month? Set up a recurring invoice.
        </Link>
      )}
    </div>
  );
}

const CONFETTI_COLORS = ["#0f7560", "#2fb38f", "#f2bd5c", "#e9a83a", "#b6e6d3", "#2563d9"];

/** A short, light burst. Skipped entirely with reduced motion. */
function Confetti({ onDone }: { onDone: () => void }) {
  const reduce = useReducedMotion();
  useEffect(() => {
    const t = setTimeout(onDone, 1800);
    return () => clearTimeout(t);
  }, [onDone]);
  if (reduce) return null;
  return (
    <div className="confetti" aria-hidden>
      {Array.from({ length: 26 }).map((_, i) => {
        const a = (i / 26) * Math.PI * 2;
        const d = 90 + (i % 5) * 26;
        return (
          <motion.span
            key={i}
            style={{ background: CONFETTI_COLORS[i % CONFETTI_COLORS.length] }}
            initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
            animate={{ x: Math.cos(a) * d, y: Math.sin(a) * d + 60, opacity: 0, rotate: (i % 2 ? 1 : -1) * 220 }}
            transition={{ duration: 1.4, ease }}
          />
        );
      })}
    </div>
  );
}
