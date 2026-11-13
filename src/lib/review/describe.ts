// Change notes in plain words: the request's details text, so a set of notes reads properly
// anywhere a request is shown (the portal, LMS Dash, an MCP client) even without the pins.

export type NoteKind = "pin" | "text" | "draw" | "page";
export const NOTE_KINDS: NoteKind[] = ["pin", "text", "draw", "page"];
export const KIND_LABEL: Record<NoteKind, string> = { pin: "Comment", text: "Wording", draw: "Drawing", page: "Page note" };
export type NoteSource = "site" | "template";

/** Below this frame width a note is about the phone layout. */
export const PHONE_MAX = 600;

export type DescribableNote = {
  kind: string;
  pagePath: string;
  pageTitle: string;
  viewportW: number;
  body: string;
  textBefore: string | null;
  textAfter: string | null;
  anchor: { text: string; tag: string } | null;
  fileName?: string | null;
};

export function pageLabel(note: { pagePath: string; pageTitle: string }) {
  const title = note.pageTitle.trim();
  return title ? `${title} (${note.pagePath})` : note.pagePath;
}

function quote(text: string, max = 160) {
  const flat = text.replace(/\s+/g, " ").trim();
  return `“${flat.length > max ? `${flat.slice(0, max - 1)}…` : flat}”`;
}

export function describeNote(note: DescribableNote): string[] {
  const kind = KIND_LABEL[note.kind as NoteKind] ?? "Note";
  const phone = note.viewportW > 0 && note.viewportW <= PHONE_MAX ? ", phone layout" : "";
  const lines = [`${kind} on ${pageLabel(note)}${phone}`];
  if (note.kind === "text" && note.textBefore != null && note.textAfter != null) {
    lines.push(`Change ${quote(note.textBefore)} to ${quote(note.textAfter)}`);
  } else if (note.anchor?.text) {
    lines.push(`At ${quote(note.anchor.text, 100)}`);
  } else if (note.anchor?.tag === "img") {
    lines.push("At a picture");
  }
  if (note.body.trim()) lines.push(note.body.trim());
  if (note.fileName) lines.push(`Attached: ${note.fileName}`);
  return lines;
}

export function describeNotes(notes: DescribableNote[], opts: { source: NoteSource; neededBy?: string | null }): string {
  const where = opts.source === "template" ? "the design" : "the website";
  const head = [`${notes.length} ${notes.length === 1 ? "change" : "changes"} marked on ${where}.`];
  if (opts.neededBy) head.push(`Needed by ${opts.neededBy}.`);
  const body = notes.map((n, i) => {
    const [first, ...rest] = describeNote(n);
    return [`${i + 1}. ${first}`, ...rest.map((l) => `   ${l}`)].join("\n");
  });
  return [head.join(" "), ...body].join("\n\n");
}

export function defaultTitle(count: number, source: NoteSource) {
  const what = source === "template" ? "Design feedback" : "Website changes";
  return `${what}: ${count} ${count === 1 ? "note" : "notes"}`;
}
