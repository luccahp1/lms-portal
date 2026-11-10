import Link from "next/link";
import { IntakeFlow } from "@/components/features/IntakeFlow";
import { loadStart } from "@/lib/data/intake";
import { fillQuery, TEMPLATES } from "@/lib/templates";
import { claimStartAction, pickTemplateAction, saveAnswersAction } from "./actions";

export const metadata = { title: "Get started", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

function Shell({ agency, children }: { agency: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas">
      <header className="k-band" style={{ position: "static" }}>
        <span className="k-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/mark.svg" alt="" width={30} height={31} />
          <span className="k-brand__text">
            <span className="k-brand__wm">{agency}</span>
            <span className="k-brand__sub">Getting started</span>
          </span>
        </span>
      </header>
      <main className="mx-auto flex max-w-[1240px] flex-col gap-6 px-4 py-8">{children}</main>
    </div>
  );
}

// A new client's personal start link: pick a design, answer a few questions, create the
// portal login. No account needed until the last step; the token in the address is the key.
export default async function StartPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const start = await loadStart(token);
  if (!start) {
    return (
      <Shell agency="London Marketing Solutions">
        <section className="k-card k-card--still mx-auto max-w-lg">
          <h1 className="font-display text-2xl font-bold">This link has expired</h1>
          <p className="text-ink-2">Start links last 30 days. Reply to the message it came in and we will send you a fresh one.</p>
        </section>
      </Shell>
    );
  }
  if (start.claimed) {
    return (
      <Shell agency={start.agencyName}>
        <section className="k-card k-card--still mx-auto flex max-w-lg flex-col gap-3">
          <h1 className="font-display text-2xl font-bold">You are all set</h1>
          <p className="text-ink-2">{start.clientName} already has a portal login. Sign in to follow your project, change your answers or mark up your design.</p>
          <Link className="k-btn k-btn--pri self-start" href="/login">
            Sign in to my portal
          </Link>
        </section>
      </Shell>
    );
  }

  const first = start.contactName.split(" ")[0];
  const fill = { business: start.clientName, phone: start.intake.answers.phone };
  // What we already know goes in as a first answer, so they only confirm it.
  const answers = { legalName: start.clientName, ...start.intake.answers };
  return (
    <Shell agency={start.agencyName}>
      <header className="k-ph" style={{ marginBottom: 0 }}>
        <div>
          <div className="k-ph__k k-mono">{start.clientName}</div>
          <h1>{first ? `Welcome, ${first}.` : "Welcome."} Let’s plan your website.</h1>
          <p>Three short steps, about ten minutes. Everything saves as you go, so you can stop and come back with this same link.</p>
        </div>
      </header>
      <IntakeFlow
        templates={TEMPLATES.map(({ slug, name, fits, blurb }) => ({ slug, name, fits, blurb }))}
        query={fillQuery(fill)}
        businessName={start.clientName}
        contactName={start.contactName}
        initial={{
          templateSlug: start.intake.templateSlug,
          templateNote: start.intake.templateNote,
          answers,
          submitted: Boolean(start.intake.submittedAt),
        }}
        pick={pickTemplateAction.bind(null, token)}
        save={saveAnswersAction.bind(null, token)}
        claim={claimStartAction.bind(null, token)}
      />
    </Shell>
  );
}
