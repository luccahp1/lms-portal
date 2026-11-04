import type { Viewer } from "@/lib/data/viewer";

/** LMS Dash's address when one login is on (DASH_URL). Agency admins land there, not here. */
export function dashUrl() {
  return (process.env.DASH_URL || "").replace(/\/$/, "");
}

/** Where someone goes after signing in. The account decides; nobody picks a side. */
export function homePath(viewer: Viewer) {
  if (viewer.status !== "active") return "/pending";
  if (viewer.role === "agency_admin") return dashUrl() ? "/sso/dash" : "/admin";
  return "/portal";
}
