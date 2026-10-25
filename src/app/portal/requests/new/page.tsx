import { requireClient } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui";
import { NewRequestForm } from "@/components/features/NewRequestForm";

export const metadata = { title: "New request" };

export default async function NewRequestPage() {
  await requireClient();
  return (
    <>
      <PageHeader title="New request" subtitle="We’ll reply here and keep you posted as it moves along." />
      <NewRequestForm cancelHref="/portal/requests" />
    </>
  );
}
