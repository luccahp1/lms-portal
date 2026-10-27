import { redirect } from "next/navigation";
import { getViewer, homePath } from "@/lib/auth/session";

export default async function Root() {
  const viewer = await getViewer();
  redirect(viewer ? homePath(viewer) : "/login");
}
