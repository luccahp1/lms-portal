import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth/session";
import { Button } from "@/components/ui";
import { AuthShell } from "../AuthShell";
import { logout } from "../actions";

export const metadata = { title: "Almost there" };

export default async function PendingPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  if (viewer.status === "active") redirect("/");
  return (
    <AuthShell title={`Thanks, ${viewer.name.split(" ")[0]}!`} subtitle="Your account is created.">
      <div className="flex flex-col gap-4">
        <p>
          We’re connecting it to your business now. Once that’s done you’ll see everything here when you log in with{" "}
          <strong className="font-semibold">{viewer.email}</strong>.
        </p>
        <form action={logout}>
          <Button type="submit" variant="secondary">
            Log out
          </Button>
        </form>
      </div>
    </AuthShell>
  );
}
