import { KitCard } from "@/components/kit";
import { faqItems } from "@/lib/billing";

/** Billing questions and answers, at the bottom of the Billing page. */
export function BillingFaq({ monthlyCents }: { monthlyCents: number | null | undefined }) {
  return (
    <KitCard c="jay" icon="chat" title="Billing questions" sub="How billing works under your agreement" span="k-s12" still>
      <div className="k-faq">
        {faqItems(monthlyCents).map((i) => (
          <details key={i.q}>
            <summary>{i.q}</summary>
            <p>{i.a}</p>
          </details>
        ))}
      </div>
    </KitCard>
  );
}
