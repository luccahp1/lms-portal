import { requireAdmin } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui";
import { NewClientForm } from "./NewClientForm";

export const metadata = { title: "New client" };

export default async function NewClientPage() {
  await requireAdmin();
  return (
    <>
      <PageHeader title="New client" subtitle="Add the business and the person who will log in. You’ll get an invite link to send them." />
      <NewClientForm />
    </>
  );
}
