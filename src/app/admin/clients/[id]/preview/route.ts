import { redirect } from "next/navigation";
import { requireAdmin, startPreview } from "@/lib/auth/session";
import { previewViewer } from "@/lib/data/preview";
import { NotFoundError } from "@/lib/data/viewer";

const UUID = /^[0-9a-f-]{36}$/i;

// "View as client": opens the client portal as this client sees it.
// ?user=<id> picks which of the client's people to view as.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  const { id } = await params;
  const user = new URL(req.url).searchParams.get("user") ?? undefined;
  if (!UUID.test(id) || (user && !UUID.test(user))) return new Response("Not found", { status: 404 });
  try {
    await previewViewer(admin, id, user);
  } catch (err) {
    if (err instanceof NotFoundError) return new Response("Not found", { status: 404 });
    throw err;
  }
  await startPreview(id, user);
  redirect("/portal");
}
