import { requireAdmin } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui";
import { NewClientForm } from "./NewClientForm";

export const metadata = { title: "New client" };

export default async function NewClientPage() {
  await requireAdmin();
  return (
    <>
      <PageHeader
        title="New client"
        subtitle="Add the business. When they sign up with your sign-up link, you’ll connect their account to it."
      />
      <NewClientForm />
    </>
  );
}
