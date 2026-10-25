import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth/session";

export default async function Root() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  redirect(viewer.role === "agency_admin" ? "/admin" : "/portal");
}
