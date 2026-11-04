import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth/session";
import { AuthShell } from "../AuthShell";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Sign in" };

export default async function LoginPage() {
  if (await getViewer()) redirect("/");
  return (
    <AuthShell title="Sign in" subtitle="London Marketing Solutions">
      <LoginForm />
    </AuthShell>
  );
}
