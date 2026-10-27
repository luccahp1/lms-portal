import { getViewer } from "@/lib/auth/session";
import { getFile } from "@/lib/data/files";
import { NotFoundError } from "@/lib/data/viewer";
import { downloadResponse } from "@/lib/storage";

// Authenticated download. Checks access, then streams from disk or redirects to
// a short-lived R2 link. Always an attachment, so uploaded HTML/SVG never renders.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer || viewer.status !== "active") return new Response("Not found", { status: 404 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });
  try {
    const file = await getFile(viewer, id);
    return await downloadResponse(file.storageKey, file.name);
  } catch (err) {
    if (err instanceof NotFoundError || (err as NodeJS.ErrnoException).code === "ENOENT") {
      return new Response("Not found", { status: 404 });
    }
    throw err;
  }
}
