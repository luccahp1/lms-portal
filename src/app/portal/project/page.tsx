import { requireClient } from "@/lib/auth/session";
import { getClient } from "@/lib/data/clients";
import { getIntake } from "@/lib/data/intake";
import { fillQuery, TEMPLATES } from "@/lib/templates";
import { PageHeader } from "@/components/ui";
import { IntakeFlow } from "@/components/features/IntakeFlow";
import { saveIntakeAnswersAction, saveIntakePickAction } from "@/app/actions";

export const metadata = { title: "Your project" };

// The design a client picked and what they told us, editable after they have a login.
export default async function ProjectPage() {
  const viewer = await requireClient();
  const [client, intake] = await Promise.all([getClient(viewer), getIntake(viewer)]);
  return (
    <>
      <PageHeader title="Your project" subtitle="The design you picked and what you told us about your business. Change either any time." />
      <IntakeFlow
        templates={TEMPLATES.map(({ slug, name, fits, blurb }) => ({ slug, name, fits, blurb }))}
        query={fillQuery({ business: client.name, phone: intake.answers.phone })}
        businessName={client.name}
        contactName={viewer.name}
        initial={{
          templateSlug: intake.templateSlug,
          templateNote: intake.templateNote,
          answers: { legalName: client.name, ...intake.answers },
          submitted: Boolean(intake.submittedAt),
        }}
        pick={saveIntakePickAction}
        save={saveIntakeAnswersAction}
        readOnly={Boolean(viewer.previewBy)}
      />
    </>
  );
}
