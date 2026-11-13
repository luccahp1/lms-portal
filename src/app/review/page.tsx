import { notFound } from "next/navigation";
import { requireClient } from "@/lib/auth/session";
import { getClient } from "@/lib/data/clients";
import { getRequest } from "@/lib/data/requests";
import { listDraft, reviewTarget } from "@/lib/data/review";
import { NotFoundError } from "@/lib/data/viewer";
import { mintReviewToken } from "@/lib/review/token";
import type { NoteSource } from "@/lib/review/describe";
import { findTemplate } from "@/lib/templates";
import { requestStatusLabel } from "@/lib/format";
import { ReviewTool } from "./ReviewTool";
import { toClientNote } from "./shared";
import "./review.css";

export const metadata = { title: "Request website changes" };

// The client's website (or the design they picked) in a frame, with tools to mark it up.
// ?source=template shows the design; ?request=<id> shows a sent request's notes, look only.
export default async function ReviewPage({ searchParams }: { searchParams: Promise<{ source?: string; request?: string }> }) {
  const viewer = await requireClient();
  const sp = await searchParams;
  const client = await getClient(viewer);
  let source: NoteSource = sp.source === "template" ? "template" : "site";
  let readOnly = Boolean(viewer.previewBy);
  let request: { id: string; title: string; status: string } | null = null;
  let notes;

  if (sp.request) {
    if (!/^[0-9a-f-]{36}$/i.test(sp.request)) notFound();
    try {
      const data = await getRequest(viewer, sp.request);
      notes = data.changeNotes;
      request = { id: data.request.id, title: data.request.title, status: requestStatusLabel[data.request.status].label };
    } catch (err) {
      if (err instanceof NotFoundError) notFound();
      throw err;
    }
    if (notes[0]) source = notes[0].source === "template" ? "template" : "site";
    readOnly = true;
  } else {
    notes = await listDraft(viewer, source);
  }

  const target = await reviewTarget(client.id);
  const template = findTemplate(target?.templateSlug);
  const available = source === "template" ? Boolean(template) : Boolean(target?.siteUrl);
  let label = "";
  if (source === "template") label = template ? `${template.name} design` : "Your design";
  else if (target?.siteUrl) label = target.siteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");

  return (
    <ReviewTool
      frameBase={`/site/${mintReviewToken({ clientId: client.id, source })}`}
      source={source}
      siteLabel={label}
      available={available}
      readOnly={readOnly}
      preview={Boolean(viewer.previewBy)}
      request={request}
      initialNotes={notes.map(toClientNote)}
    />
  );
}
