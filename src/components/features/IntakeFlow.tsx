"use client";

import { useActionState, useRef, useState } from "react";
import { INTAKE_QUESTIONS, answeredCount } from "@/lib/intake";
import { TemplateGallery, type GalleryTemplate } from "./TemplateGallery";

// A new client's first job with us, in three short steps: pick a design, tell us about the
// business, get a portal login. The same component runs on the start link (no login yet,
// actions bound to the link's token) and on the portal's Your project page (signed in, no
// login step).

export type IntakeResult = { ok: true } | { ok: false; error: string };
export type ClaimState = { error?: string } | undefined;

type Props = {
  templates: GalleryTemplate[];
  /** Query string that puts this business's name on every design. */
  query: string;
  businessName: string;
  contactName: string;
  initial: { templateSlug: string | null; templateNote: string; answers: Record<string, string>; submitted: boolean };
  pick: (slug: string, note: string) => Promise<IntakeResult>;
  save: (answers: Record<string, string>, submit: boolean) => Promise<IntakeResult>;
  /** Start link only: creates the login and signs them in. */
  claim?: (prev: ClaimState, formData: FormData) => Promise<ClaimState>;
  /** Where "done" leads on the portal. */
  doneHref?: string;
  /** Look only (an admin previewing as the client). */
  readOnly?: boolean;
};

const field = "w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-ink placeholder:text-muted/70";

export function IntakeFlow({ templates, query, businessName, contactName, initial, pick, save, claim, doneHref, readOnly }: Props) {
  const [slug, setSlug] = useState(initial.templateSlug);
  const [note, setNote] = useState(initial.templateNote);
  const [answers, setAnswers] = useState<Record<string, string>>(initial.answers);
  const [submitted, setSubmitted] = useState(initial.submitted);
  const [step, setStep] = useState<1 | 2 | 3>(!initial.templateSlug ? 1 : !initial.submitted ? 2 : 3);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [savedAt, setSavedAt] = useState("");
  const dirty = useRef(false);
  const steps = claim ? ["Pick a design", "About your business", "Your login"] : ["Pick a design", "About your business", "Next"];
  const chosen = templates.find((t) => t.slug === slug);

  async function run(job: () => Promise<IntakeResult>, then?: () => void) {
    if (readOnly) return then?.();
    setBusy(true);
    setError("");
    try {
      const res = await job();
      if (!res.ok) return setError(res.error);
      then?.();
    } finally {
      setBusy(false);
    }
  }

  function choose(next: string) {
    setSlug(next);
    void run(() => pick(next, note));
  }

  // Answers save when a field is left, so closing the tab loses nothing.
  function autosave() {
    if (!dirty.current || readOnly) return;
    dirty.current = false;
    void save(answers, false).then((res) => {
      if (res.ok) setSavedAt(new Date().toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" }));
      else setError(res.error);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <ol className="flex flex-wrap gap-2" aria-label="Steps">
        {steps.map((label, i) => {
          const n = (i + 1) as 1 | 2 | 3;
          const done = n === 1 ? Boolean(slug) : n === 2 ? submitted : false;
          const reachable = n === 1 || (n === 2 && Boolean(slug)) || (n === 3 && Boolean(slug) && submitted);
          return (
            <li key={label}>
              <button
                type="button"
                disabled={!reachable}
                onClick={() => setStep(n)}
                aria-current={step === n ? "step" : undefined}
                className={`flex items-center gap-2 rounded-full border px-4 py-2 font-semibold disabled:opacity-50 ${
                  step === n ? "border-accent bg-accent text-white" : "border-line bg-surface text-ink-2"
                }`}
              >
                <span className={`grid size-6 place-items-center rounded-full text-xs ${step === n ? "bg-white/25" : done ? "bg-good-bg text-good" : "bg-subtle"}`}>
                  {done && step !== n ? "✓" : n}
                </span>
                {label}
              </button>
            </li>
          );
        })}
      </ol>

      {error && (
        <p role="alert" className="rounded-lg bg-bad-bg px-3 py-2 text-bad">
          {error}
        </p>
      )}

      {step === 1 && (
        <section className="flex flex-col gap-5">
          <div>
            <h2 className="font-display text-2xl font-bold">Which of these feels most like {businessName}?</h2>
            <p className="text-ink-2">
              Ten starting points, each with your name on it. Pick the closest one. It is only a direction: the photos, colours and words all become yours, and you can change your
              mind.
            </p>
          </div>
          <TemplateGallery templates={templates} query={query} selected={slug} onPick={readOnly ? undefined : choose} busy={busy} />
          {slug && (
            <div className="k-card k-card--still flex flex-col gap-3">
              <label className="flex flex-col gap-1.5 font-medium">
                What do you like about {chosen?.name ?? "it"}? Anything you would change?
                <textarea
                  className={`${field} resize-y font-normal`}
                  rows={3}
                  maxLength={2000}
                  value={note}
                  disabled={readOnly}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. Love the big phone number. Our colours are green and white. No stock photos, we have our own."
                />
              </label>
              <div className="flex justify-end">
                <button type="button" className="k-btn k-btn--pri" disabled={busy} onClick={() => run(() => pick(slug, note), () => setStep(2))}>
                  Continue
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {step === 2 && (
        <form
          className="k-card k-card--still flex flex-col gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            dirty.current = false;
            void run(
              () => save(answers, true),
              () => {
                setSubmitted(true);
                setStep(3);
              },
            );
          }}
        >
          <div>
            <h2 className="font-display text-2xl font-bold">About your business</h2>
            <p className="text-ink-2">
              Short answers are fine, and you can skip anything you are not sure of. This is what we write your site from.{" "}
              <span className="text-muted">
                {answeredCount(answers)} of {INTAKE_QUESTIONS.length} answered{savedAt ? ` · saved ${savedAt}` : ""}
              </span>
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {INTAKE_QUESTIONS.map((q) => (
              <label key={q.key} className={`flex flex-col gap-1.5 font-medium ${q.long ? "md:col-span-2" : ""}`}>
                {q.label}
                {q.long ? (
                  <textarea
                    className={`${field} resize-y font-normal`}
                    rows={3}
                    maxLength={2000}
                    disabled={readOnly}
                    value={answers[q.key] ?? ""}
                    onChange={(e) => {
                      dirty.current = true;
                      setAnswers((a) => ({ ...a, [q.key]: e.target.value }));
                    }}
                    onBlur={autosave}
                  />
                ) : (
                  <input
                    className={`${field} min-h-10 font-normal`}
                    maxLength={300}
                    disabled={readOnly}
                    value={answers[q.key] ?? ""}
                    onChange={(e) => {
                      dirty.current = true;
                      setAnswers((a) => ({ ...a, [q.key]: e.target.value }));
                    }}
                    onBlur={autosave}
                  />
                )}
                {q.hint && <span className="text-xs font-normal text-muted">{q.hint}</span>}
              </label>
            ))}
          </div>
          <div className="flex flex-wrap justify-between gap-2">
            <button type="button" className="k-btn" onClick={() => setStep(1)}>
              Back to designs
            </button>
            <button type="submit" className="k-btn k-btn--pri" disabled={busy || readOnly}>
              {submitted ? "Save changes" : "Send to London Marketing Solutions"}
            </button>
          </div>
        </form>
      )}

      {step === 3 && claim && <ClaimForm claim={claim} contactName={contactName} email={answers.email ?? ""} />}

      {step === 3 && !claim && (
        <section className="k-card k-card--still flex flex-col gap-3">
          <h2 className="font-display text-2xl font-bold">That is everything we need for now</h2>
          <p className="text-ink-2">
            We have your design ({chosen?.name}) and your answers. Want to be more exact? Open the design and point at anything you would change.
          </p>
          <div className="flex flex-wrap gap-2">
            <a className="k-btn k-btn--pri" href="/review?source=template">
              Mark up my design
            </a>
            <a className="k-btn" href={doneHref ?? "/portal"}>
              Back to my portal
            </a>
          </div>
        </section>
      )}
    </div>
  );
}

function ClaimForm({ claim, contactName, email }: { claim: NonNullable<Props["claim"]>; contactName: string; email: string }) {
  const [state, action, pending] = useActionState(claim, undefined);
  return (
    <form action={action} className="k-card k-card--still flex max-w-xl flex-col gap-4">
      <div>
        <h2 className="font-display text-2xl font-bold">Last step: your portal login</h2>
        <p className="text-ink-2">
          Your portal is where you follow the build, send us photos, ask for changes and see your invoices. Choose a password and you are in.
        </p>
      </div>
      {state?.error && (
        <p role="alert" className="rounded-lg bg-bad-bg px-3 py-2 text-bad">
          {state.error}
        </p>
      )}
      <label className="flex flex-col gap-1.5 font-medium">
        Your name
        <input name="name" className={`${field} min-h-10 font-normal`} defaultValue={contactName} required maxLength={200} autoComplete="name" />
      </label>
      <label className="flex flex-col gap-1.5 font-medium">
        Email
        <input name="email" type="email" className={`${field} min-h-10 font-normal`} defaultValue={email} required autoComplete="email" />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 font-medium">
          Password
          <input name="password" type="password" className={`${field} min-h-10 font-normal`} required minLength={10} autoComplete="new-password" />
          <span className="text-xs font-normal text-muted">At least 10 characters.</span>
        </label>
        <label className="flex flex-col gap-1.5 font-medium">
          Password again
          <input name="confirm" type="password" className={`${field} min-h-10 font-normal`} required minLength={10} autoComplete="new-password" />
        </label>
      </div>
      <div className="flex justify-end">
        <button type="submit" className="k-btn k-btn--pri" disabled={pending}>
          {pending ? "Setting up…" : "Open my portal"}
        </button>
      </div>
    </form>
  );
}
