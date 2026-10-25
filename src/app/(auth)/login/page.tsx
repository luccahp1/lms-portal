import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth/session";
import { AuthShell } from "../AuthShell";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Log in" };

export default async function LoginPage() {
  if (await getViewer()) redirect("/");
  return (
    <AuthShell title="Log in" subtitle="Welcome back to your client portal.">
      <LoginForm />
    </AuthShell>
  );
}
