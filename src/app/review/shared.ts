import type { NoteAnchor } from "@/db/schema";
import type { Note } from "@/lib/data/review";
import type { NoteKind } from "@/lib/review/describe";

// A change note as the review page holds it in the browser.
export type ClientNote = {
  id: string;
  kind: NoteKind;
  pagePath: string;
  pageTitle: string;
  anchor: NoteAnchor | null;
  viewportW: number;
  body: string;
  textBefore: string | null;
  textAfter: string | null;
  strokes: number[][] | null;
  fileId: string | null;
  fileName: string | null;
  doneAt: string | null;
};

export function toClientNote(n: Note): ClientNote {
  return {
    id: n.id,
    kind: n.kind as NoteKind,
    pagePath: n.pagePath,
    pageTitle: n.pageTitle,
    anchor: n.anchor ?? null,
    viewportW: n.viewportW,
    body: n.body,
    textBefore: n.textBefore,
    textAfter: n.textAfter,
    strokes: n.strokes ?? null,
    fileId: n.fileId,
    fileName: n.fileName ?? null,
    doneAt: n.doneAt ? n.doneAt.toISOString() : null,
  };
}

export type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };
