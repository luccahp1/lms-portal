import Link from "next/link";
import { KitCard } from "@/components/kit";

// "Your website project" on the Overview while a new client's site is being made: where
// things stand and the one thing they can do next. Hidden once the site is live, and for
// clients from before onboarding existed (stage "").

type Props = {
  stage: string;
  templateName: string | null;
  answersSent: boolean;
  openTodos: number;
  /** There is a version of the site to look at. */
  hasSite: boolean;
};

const BUILDING = ["discovery", "design", "build", "review"];

export function showProjectTracker(stage: string) {
  return BUILDING.includes(stage);
}

export function ProjectTracker({ stage, templateName, answersSent, openTodos, hasSite }: Props) {
  const reviewing = stage === "review";
  const steps = [
    { label: "Pick a design", done: Boolean(templateName), note: templateName ?? "" },
    { label: "Tell us about your business", done: answersSent, note: "" },
    { label: "We build your site", done: reviewing, note: stage === "build" ? "under way" : "" },
    { label: "You look it over", done: false, note: "" },
    { label: "Live", done: false, note: "" },
  ];
  const current = steps.findIndex((s) => !s.done);

  let next: { text: string; href?: string; cta?: string };
  if (current === 0) next = { text: "Pick the design closest to what you have in mind. It takes a couple of minutes.", href: "/portal/project", cta: "Pick a design" };
  else if (current === 1) next = { text: "Answer a few questions about your business so we can write your site.", href: "/portal/project", cta: "Answer the questions" };
  else if (reviewing) next = { text: "Your site is ready for you. Open it and point at anything you want changed.", href: "/review", cta: "Look at my website" };
  else if (openTodos) next = { text: `We are on it. There ${openTodos === 1 ? "is one thing" : `are ${openTodos} things`} only you can do, so we can keep going.`, href: "/portal/todos", cta: "See my to-dos" };
  else if (stage === "build" && hasSite) next = { text: "We are building. You can look at where it stands any time, and point at anything you want changed.", href: "/review", cta: "Look at my website" };
  else next = { text: stage === "build" ? "We are building your site. We will tell you here as soon as there is something to look at." : "We have what we need and are getting your build ready." };

  return (
    <KitCard c="jay" icon="web" title="Your website project" sub={`Step ${Math.min(current + 1, steps.length)} of ${steps.length}`} span="k-s12" still>
      <ol className="grid gap-2 sm:grid-cols-5">
        {steps.map((s, i) => (
          <li
            key={s.label}
            aria-current={i === current ? "step" : undefined}
            className={`flex items-start gap-2.5 rounded-xl border px-3 py-2.5 ${i === current ? "border-info bg-info-bg" : "border-line"} ${i > current ? "opacity-60" : ""}`}
          >
            <span className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold ${s.done ? "bg-good text-white" : i === current ? "bg-info text-white" : "bg-subtle text-ink-2"}`}>
              {s.done ? "✓" : i + 1}
            </span>
            <span className="flex min-w-0 flex-col leading-snug">
              <span className="font-semibold">{s.label}</span>
              {s.note && <span className="truncate text-xs text-muted">{s.note}</span>}
            </span>
          </li>
        ))}
      </ol>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-ink-2">{next.text}</p>
        <div className="flex flex-wrap gap-2">
          {templateName && current > 1 && !reviewing && (
            <Link className="k-btn" href="/review?source=template">
              Mark up my design
            </Link>
          )}
          {next.href && (
            <Link className="k-btn k-btn--pri" href={next.href}>
              {next.cta}
            </Link>
          )}
        </div>
      </div>
    </KitCard>
  );
}
