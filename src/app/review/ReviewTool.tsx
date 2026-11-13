"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { NoteAnchor } from "@/db/schema";
import { defaultTitle, KIND_LABEL, PHONE_MAX, type NoteSource } from "@/lib/review/describe";
import { SANDBOX } from "@/lib/review/sandbox";
import { addNoteAction, deleteNoteAction, submitDraftAction, updateNoteAction, uploadNoteFileAction } from "./actions";
import type { ClientNote } from "./shared";

// "Request website changes": the client's site in a frame with a few tools on top. The page
// inside the frame runs public/review-agent.js, which draws pins and reports clicks; this
// component owns the tools, the list of notes and saving. They talk with postMessage.

type Mode = "browse" | "comment" | "text" | "draw";
type Composer =
  | { kind: "pin"; anchor: NoteAnchor; isImage: boolean }
  | { kind: "draw"; anchor: NoteAnchor; strokes: number[][] }
  | { kind: "page" };

const TOOLS: { mode: Mode; label: string; key: string; help: string; icon: React.ReactNode }[] = [
  {
    mode: "browse",
    label: "Browse",
    key: "B",
    help: "Use the site as normal to get to the page you want to change.",
    icon: <path d="m5 3 14 7-6 2-2 6z" />,
  },
  {
    mode: "comment",
    label: "Comment",
    key: "C",
    help: "Click anything on the page and say what should change. You can attach a photo.",
    icon: <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />,
  },
  {
    mode: "text",
    label: "Edit text",
    key: "T",
    help: "Click any wording and type what it should say. Press Enter when you are done.",
    icon: <path d="M5 6V4h14v2M12 4v16M9 20h6" />,
  },
  {
    mode: "draw",
    label: "Draw",
    key: "D",
    help: "Circle something or draw an arrow, then add a note. Scroll with the mouse wheel, or switch to Browse.",
    icon: <path d="m4 20 1-5L16 4l4 4L9 19zM14 6l4 4" />,
  },
];

function Icon({ children, size = 17 }: { children: React.ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

function summary(n: ClientNote) {
  if (n.kind === "text") return null;
  return n.body || (n.fileName ? "See the attached file." : "");
}

export function ReviewTool({
  frameBase,
  source,
  siteLabel,
  available,
  readOnly,
  preview,
  request,
  initialNotes,
}: {
  frameBase: string;
  source: NoteSource;
  siteLabel: string;
  available: boolean;
  readOnly: boolean;
  preview: boolean;
  request: { id: string; title: string; status: string } | null;
  initialNotes: ClientNote[];
}) {
  const router = useRouter();
  const frame = useRef<HTMLIFrameElement>(null);
  const [notes, setNotes] = useState(initialNotes);
  const [mode, setMode] = useState<Mode>("browse");
  const [page, setPage] = useState({ path: "/", title: "" });
  const [frameW, setFrameW] = useState(0);
  const [device, setDevice] = useState<"desktop" | "phone">("desktop");
  const [composer, setComposer] = useState<Composer | null>(null);
  const [drawCount, setDrawCount] = useState(0);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ text: string; bad?: boolean } | null>(null);
  const [loaded, setLoaded] = useState(false);

  // The frame's messages arrive outside React's render, so they read the latest values here.
  const live = useRef({ notes, mode, page, frameW, composer });
  live.current = { notes, mode, page, frameW, composer };
  const focusAfterLoad = useRef<string | null>(null);

  const numbered = useMemo(() => notes.map((n, i) => ({ ...n, n: i + 1 })), [notes]);

  const post = useCallback((msg: Record<string, unknown>) => {
    // The framed page has an origin of its own (it is sandboxed), so it can't be named here.
    frame.current?.contentWindow?.postMessage({ lms: 1, ...msg }, "*");
  }, []);

  const say = useCallback((text: string, bad = false) => {
    setToast({ text, bad });
    window.setTimeout(() => setToast((t) => (t?.text === text ? null : t)), 4200);
  }, []);

  const changeMode = useCallback(
    (next: Mode) => {
      if (readOnly) return;
      setMode(next);
      setComposer((c) => (c && c.kind !== "page" ? null : c));
      if (next !== "draw") setDrawCount(0);
      post({ type: "mode", mode: next });
    },
    [post, readOnly],
  );

  // Every change to the notes goes to the frame, which redraws its pins.
  useEffect(() => {
    post({ type: "notes", notes: numbered });
  }, [numbered, post]);

  const saveText = useCallback(
    async (m: { anchor?: NoteAnchor; before: string; after: string; replaces?: string }) => {
      const { page: pg, frameW: w } = live.current;
      if (m.before === m.after) {
        if (!m.replaces) return;
        const res = await deleteNoteAction(source, m.replaces);
        if (res.ok) setNotes(res.notes);
        return;
      }
      const res = await addNoteAction(
        source,
        { kind: "text", pagePath: pg.path, pageTitle: pg.title, anchor: m.anchor, viewportW: w, textBefore: m.before, textAfter: m.after },
        m.replaces,
      );
      if (res.ok) {
        setNotes(res.notes);
        say("Wording change saved.");
      } else {
        say(res.error, true);
        post({ type: "notes", notes: live.current.notes.map((n, i) => ({ ...n, n: i + 1 })) });
      }
    },
    [post, say, source],
  );

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (!frame.current || e.source !== frame.current.contentWindow) return;
      const m = e.data as { lms?: number; type?: string } & Record<string, unknown>;
      if (!m || m.lms !== 1 || typeof m.type !== "string") return;
      const cur = live.current;
      if (m.type === "ready") {
        const path = typeof m.path === "string" ? m.path.slice(0, 500) : "/";
        setPage({ path, title: typeof m.title === "string" ? m.title.slice(0, 200) : "" });
        if (typeof m.width === "number") setFrameW(Math.round(m.width));
        setLoaded(true);
        setDrawCount(0);
        setComposer((c) => (c && c.kind !== "page" ? null : c));
        post({ type: "init", mode: cur.mode, readOnly, notes: cur.notes.map((n, i) => ({ ...n, n: i + 1 })) });
        if (focusAfterLoad.current) {
          const id = focusAfterLoad.current;
          focusAfterLoad.current = null;
          window.setTimeout(() => post({ type: "focus", id }), 250);
        }
      } else if (m.type === "size" && typeof m.width === "number") {
        setFrameW(Math.round(m.width));
      } else if (m.type === "pick" && m.anchor && !readOnly) {
        setComposer({ kind: "pin", anchor: m.anchor as NoteAnchor, isImage: Boolean(m.isImage) });
        setPanelOpen(true);
      } else if (m.type === "text" && !readOnly) {
        void saveText(m as unknown as { anchor?: NoteAnchor; before: string; after: string; replaces?: string });
      } else if (m.type === "drawing") {
        setDrawCount(Number(m.count) || 0);
      } else if (m.type === "draw" && m.anchor && Array.isArray(m.strokes) && !readOnly) {
        setComposer({ kind: "draw", anchor: m.anchor as NoteAnchor, strokes: m.strokes as number[][] });
        setPanelOpen(true);
      } else if (m.type === "open" && typeof m.id === "string") {
        setActiveId(m.id);
        setPanelOpen(true);
        post({ type: "focus", id: m.id });
        document.getElementById(`rv-note-${m.id}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      } else if (m.type === "hint" && typeof m.text === "string") {
        say(m.text.slice(0, 200));
      } else if (m.type === "escape") {
        if (cur.composer) cancelComposer();
        else changeMode("browse");
      } else if (m.type === "key" && typeof m.mode === "string") {
        changeMode(m.mode as Mode);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
    // cancelComposer is stable enough: it only posts and clears state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post, readOnly, saveText, say, changeMode]);

  function cancelComposer() {
    const c = live.current.composer;
    if (c?.kind === "pin") post({ type: "cancel" });
    setComposer(null);
  }

  async function saveComposer(body: string, file: File | null) {
    if (!composer) return;
    setBusy(true);
    try {
      let fileId: string | undefined;
      if (file) {
        const data = new FormData();
        data.set("file", file);
        const up = await uploadNoteFileAction(data);
        if (!up.ok) return say(up.error, true);
        fileId = up.fileId;
      }
      const base = { pagePath: page.path, pageTitle: page.title, viewportW: frameW, body, fileId };
      const input =
        composer.kind === "page"
          ? { kind: "page", ...base }
          : composer.kind === "draw"
            ? { kind: "draw", anchor: composer.anchor, strokes: composer.strokes, ...base }
            : { kind: "pin", anchor: composer.anchor, ...base };
      const res = await addNoteAction(source, input);
      if (!res.ok) return say(res.error, true);
      setNotes(res.notes);
      if (composer.kind === "draw") {
        post({ type: "draw-clear" });
        setDrawCount(0);
      }
      setComposer(null);
      setActiveId(res.notes.at(-1)?.id ?? null);
    } finally {
      setBusy(false);
    }
  }

  async function removeNote(id: string) {
    const res = await deleteNoteAction(source, id);
    if (res.ok) setNotes(res.notes);
    else say(res.error, true);
  }

  async function saveEdit(id: string, body: string) {
    const res = await updateNoteAction(source, id, body);
    if (!res.ok) return say(res.error, true);
    setNotes(res.notes);
    setEditingId(null);
  }

  function jumpTo(n: ClientNote) {
    setActiveId(n.id);
    if (n.pagePath !== page.path && frame.current) {
      focusAfterLoad.current = n.id;
      setLoaded(false);
      frame.current.src = frameBase + n.pagePath;
    } else {
      post({ type: "focus", id: n.id });
    }
    if (window.matchMedia("(max-width: 860px)").matches) setPanelOpen(false);
  }

  // Keyboard shortcuts while the focus is on this page (the frame reports its own).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement;
      if (e.ctrlKey || e.metaKey || e.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      if (e.key === "Escape") {
        if (sending) setSending(false);
        else if (live.current.composer) cancelComposer();
        else changeMode("browse");
        return;
      }
      const tool = TOOLS.find((x) => x.key.toLowerCase() === e.key.toLowerCase());
      if (tool) changeMode(tool.mode);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [changeMode, sending]);

  const groups = useMemo(() => {
    const out: { path: string; title: string; notes: (ClientNote & { n: number })[] }[] = [];
    for (const n of numbered) {
      let g = out.find((x) => x.path === n.pagePath);
      if (!g) out.push((g = { path: n.pagePath, title: n.pageTitle, notes: [] }));
      g.notes.push(n);
    }
    return out;
  }, [numbered]);

  const doneCount = notes.filter((n) => n.doneAt).length;
  const backHref = request ? `/portal/requests/${request.id}` : "/portal";
  const tool = TOOLS.find((t) => t.mode === mode)!;
  const what = source === "template" ? "design" : "website";

  return (
    <div className="rv">
      <header className="rv-bar">
        <a className="rv-back" href={preview && request ? "/portal/requests" : backHref} title="Back to your portal">
          <Icon>
            <path d="M15 5l-7 7 7 7" />
          </Icon>
          <span>{request ? "Request" : "Portal"}</span>
        </a>
        <div className="rv-title">
          <strong>{request ? request.title : source === "template" ? "Mark up your design" : "Request website changes"}</strong>
          <small>
            {siteLabel}
            {page.path !== "/" ? ` · ${page.path}` : ""}
          </small>
        </div>

        {!readOnly && available && (
          <div className="rv-tools" role="toolbar" aria-label="Tools">
            {TOOLS.map((t) => (
              <button key={t.mode} type="button" className="rv-tool" aria-pressed={mode === t.mode} onClick={() => changeMode(t.mode)} title={`${t.label} (${t.key})`}>
                <Icon>{t.icon}</Icon>
                <span>{t.label}</span>
              </button>
            ))}
            <button
              type="button"
              className="rv-tool"
              aria-pressed={composer?.kind === "page"}
              onClick={() => {
                cancelComposer();
                setComposer({ kind: "page" });
                setPanelOpen(true);
              }}
              title="A change that is not about one spot: a new section, a new page"
            >
              <Icon>
                <path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8zM14 3v5h5M12 11v6M9 14h6" />
              </Icon>
              <span>Page note</span>
            </button>
          </div>
        )}

        <div className="rv-right">
          {available && (
            <div className="rv-device" role="group" aria-label="Screen size">
              <button type="button" aria-pressed={device === "desktop"} onClick={() => setDevice("desktop")} title="Computer screen">
                <Icon>
                  <path d="M3 5h18v11H3zM8 20h8M12 16v4" />
                </Icon>
              </button>
              <button type="button" aria-pressed={device === "phone"} onClick={() => setDevice("phone")} title="Phone screen">
                <Icon>
                  <path d="M8 3h8a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM11 18h2" />
                </Icon>
              </button>
            </div>
          )}
          <button type="button" className="rv-count" onClick={() => setPanelOpen((v) => !v)} aria-expanded={panelOpen}>
            {readOnly ? `${doneCount}/${notes.length}` : notes.length} <span>{notes.length === 1 ? "note" : "notes"}</span>
          </button>
          {!readOnly && (
            <button type="button" className="k-btn k-btn--pri rv-send" disabled={notes.length === 0} onClick={() => setSending(true)}>
              Send{notes.length ? ` ${notes.length}` : ""} <span>{notes.length === 1 ? "change" : "changes"}</span>
            </button>
          )}
        </div>
      </header>

      <div className="rv-body">
        <div className={`rv-stage rv-stage--${device}`}>
          {!readOnly && available && (
            <div className="rv-help">
              <span>{tool.help}</span>
              {mode === "draw" && (
                <span className="rv-drawbar">
                  <button type="button" className="k-btn k-btn--sm" disabled={!drawCount} onClick={() => post({ type: "draw-undo" })}>
                    Undo
                  </button>
                  <button type="button" className="k-btn k-btn--sm" disabled={!drawCount} onClick={() => post({ type: "draw-clear" })}>
                    Clear
                  </button>
                  <button type="button" className="k-btn k-btn--sm k-btn--pri" disabled={!drawCount} onClick={() => post({ type: "draw-done" })}>
                    Add a note to the drawing
                  </button>
                </span>
              )}
            </div>
          )}
          {preview && (
            <div className="rv-help rv-help--warn">Preview as the client. You can look, but nothing here can be changed.</div>
          )}
          <div className="rv-frame">
            {available ? (
              <>
                {!loaded && <div className="rv-loading">Loading the {what}…</div>}
                <iframe
                  ref={frame}
                  src={`${frameBase}${initialNotes[0] && request ? initialNotes[0].pagePath : "/"}`}
                  sandbox={SANDBOX}
                  title={source === "template" ? "Your design" : "Your website"}
                  referrerPolicy="no-referrer"
                />
              </>
            ) : (
              <div className="rv-empty">
                <h2>{source === "template" ? "No design picked yet" : "Your website isn’t ready to look at yet"}</h2>
                <p>
                  {source === "template"
                    ? "Pick a design on Your project first, then come back to mark it up."
                    : "As soon as there is a version to show you, this is where you will point at anything you want changed."}
                </p>
                <a className="k-btn" href={source === "template" ? "/portal/project" : "/portal/requests/new"}>
                  {source === "template" ? "Pick a design" : "Send a written request instead"}
                </a>
              </div>
            )}
          </div>
        </div>

        <aside className={`rv-panel ${panelOpen ? "is-open" : ""}`} aria-label="Notes">
          <div className="rv-panel__head">
            <strong>{request ? `${request.status} · ${doneCount} of ${notes.length} done` : notes.length ? `${notes.length} ${notes.length === 1 ? "note" : "notes"}, not sent yet` : "Your notes"}</strong>
            <button type="button" className="rv-x" onClick={() => setPanelOpen(false)} aria-label="Close notes">
              ×
            </button>
          </div>

          {composer && (
            <ComposerForm
              key={composer.kind + ("anchor" in composer ? composer.anchor.selector + composer.anchor.docY : "")}
              composer={composer}
              pageLabel={page.title || page.path}
              phone={frameW > 0 && frameW <= PHONE_MAX}
              busy={busy}
              onCancel={cancelComposer}
              onSave={saveComposer}
            />
          )}

          {notes.length === 0 && !composer && (
            <div className="rv-none">
              {readOnly ? (
                <p>This request has no notes on the page.</p>
              ) : (
                <>
                  <p>
                    <b>Nothing marked yet.</b> Pick a tool at the top, then click on your {what}.
                  </p>
                  <ul>
                    <li>
                      <b>Comment</b> on anything: a photo, a button, a whole section.
                    </li>
                    <li>
                      <b>Edit text</b> to retype wording right on the page.
                    </li>
                    <li>
                      <b>Draw</b> when it is easier to show than to say.
                    </li>
                    <li>
                      <b>Page note</b> for something that is missing.
                    </li>
                  </ul>
                  <p className="rv-muted">Notes save as you go. Nothing reaches us until you press Send.</p>
                </>
              )}
            </div>
          )}

          <div className="rv-list">
            {groups.map((g) => (
              <section key={g.path}>
                <h3>
                  {g.title || g.path}
                  <small>{g.path === page.path ? "this page" : g.path}</small>
                </h3>
                {g.notes.map((n) => (
                  <article key={n.id} id={`rv-note-${n.id}`} className={`rv-note ${activeId === n.id ? "is-on" : ""} ${n.doneAt ? "is-done" : ""}`}>
                    <button type="button" className="rv-note__go" onClick={() => jumpTo(n)} title="Show on the page">
                      <span className={`rv-num rv-num--${n.kind}`}>{n.doneAt ? "✓" : n.n}</span>
                      <span className="rv-note__body">
                        <span className="rv-note__kind">
                          {KIND_LABEL[n.kind]}
                          {n.viewportW > 0 && n.viewportW <= PHONE_MAX ? " · phone" : ""}
                          {n.doneAt ? " · done" : ""}
                        </span>
                        {n.kind === "text" ? (
                          <span className="rv-diff">
                            <s>{n.textBefore}</s>
                            <b>{n.textAfter}</b>
                          </span>
                        ) : (
                          n.anchor?.text && <q>{n.anchor.text.length > 70 ? `${n.anchor.text.slice(0, 70)}…` : n.anchor.text}</q>
                        )}
                        {editingId !== n.id && summary(n) && <span className="rv-note__text">{summary(n)}</span>}
                        {editingId !== n.id && n.kind === "text" && n.body && <span className="rv-note__text">{n.body}</span>}
                        {n.fileName && <span className="rv-file">📎 {n.fileName}</span>}
                      </span>
                    </button>
                    {editingId === n.id && <EditForm note={n} onCancel={() => setEditingId(null)} onSave={(body) => saveEdit(n.id, body)} />}
                    {!readOnly && editingId !== n.id && (
                      <div className="rv-note__acts">
                        <button type="button" onClick={() => setEditingId(n.id)}>
                          {n.kind === "text" && !n.body ? "Add a comment" : "Edit"}
                        </button>
                        <button type="button" onClick={() => removeNote(n.id)}>
                          Delete
                        </button>
                      </div>
                    )}
                  </article>
                ))}
              </section>
            ))}
          </div>

          {request && (
            <a className="k-btn rv-panel__foot" href={`/portal/requests/${request.id}`}>
              Back to the request
            </a>
          )}
        </aside>
      </div>

      {sending && (
        <SendDialog
          count={notes.length}
          pages={groups.length}
          source={source}
          onCancel={() => setSending(false)}
          onSend={async (title, neededBy) => {
            const res = await submitDraftAction(source, { title, neededBy });
            if (!res.ok) {
              say(res.error, true);
              return;
            }
            router.push(`/portal/requests/${res.requestId}`);
          }}
        />
      )}

      {toast && (
        <div className={`rv-toast ${toast.bad ? "is-bad" : ""}`} role="status">
          {toast.text}
        </div>
      )}
    </div>
  );
}

function ComposerForm({
  composer,
  pageLabel,
  phone,
  busy,
  onCancel,
  onSave,
}: {
  composer: Composer;
  pageLabel: string;
  phone: boolean;
  busy: boolean;
  onCancel: () => void;
  onSave: (body: string, file: File | null) => void;
}) {
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  useEffect(() => box.current?.focus(), []);
  const isImage = composer.kind === "pin" && composer.isImage;
  const heading =
    composer.kind === "page" ? `About ${pageLabel}` : composer.kind === "draw" ? "About your drawing" : isImage ? "This picture" : "What should change here?";
  const placeholder =
    composer.kind === "page"
      ? "e.g. Add a section about financing, with our rates."
      : isImage
        ? "e.g. Use the photo of our new truck instead."
        : "e.g. Make this bigger. Move it above the photos.";
  return (
    <form
      className="rv-compose"
      onSubmit={(e) => {
        e.preventDefault();
        if (body.trim() || file) onSave(body.trim(), file);
      }}
    >
      <label htmlFor="rv-body">{heading}</label>
      {"anchor" in composer && composer.anchor.text && !isImage && <q>{composer.anchor.text.slice(0, 90)}</q>}
      <textarea
        id="rv-body"
        ref={box}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        maxLength={2000}
        placeholder={placeholder}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && (body.trim() || file)) onSave(body.trim(), file);
          if (e.key === "Escape") onCancel();
        }}
      />
      {composer.kind !== "draw" && (
        <label className="rv-attach">
          <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} accept={isImage ? "image/*" : undefined} />
          <span>{file ? `📎 ${file.name}` : isImage ? "Upload the picture to use instead" : "Attach a photo or file"}</span>
        </label>
      )}
      <div className="rv-compose__foot">
        <small>{phone ? "Phone layout" : ""}</small>
        <button type="button" className="k-btn k-btn--sm" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="k-btn k-btn--sm k-btn--pri" disabled={busy || (!body.trim() && !file)}>
          {busy ? "Saving…" : "Save note"}
        </button>
      </div>
    </form>
  );
}

function EditForm({ note, onCancel, onSave }: { note: ClientNote; onCancel: () => void; onSave: (body: string) => void }) {
  const [body, setBody] = useState(note.body);
  return (
    <form
      className="rv-compose rv-compose--inline"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(body);
      }}
    >
      <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} maxLength={2000} autoFocus aria-label="Note" />
      <div className="rv-compose__foot">
        <small />
        <button type="button" className="k-btn k-btn--sm" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="k-btn k-btn--sm k-btn--pri">
          Save
        </button>
      </div>
    </form>
  );
}

function SendDialog({
  count,
  pages,
  source,
  onCancel,
  onSend,
}: {
  count: number;
  pages: number;
  source: NoteSource;
  onCancel: () => void;
  onSend: (title: string, neededBy: string) => Promise<void>;
}) {
  const [title, setTitle] = useState(defaultTitle(count, source));
  const [neededBy, setNeededBy] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="rv-scrim" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <form
        className="rv-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rv-send-h"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          await onSend(title, neededBy);
          setBusy(false);
        }}
      >
        <h2 id="rv-send-h">
          Send {count} {count === 1 ? "change" : "changes"}
        </h2>
        <p>
          {count} {count === 1 ? "note" : "notes"} on {pages} {pages === 1 ? "page" : "pages"}. They become one request you can follow under Requests.
        </p>
        <label>
          Name for this request
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required />
        </label>
        <label>
          Needed by <small>(only if there is a date)</small>
          <input type="date" value={neededBy} onChange={(e) => setNeededBy(e.target.value)} />
        </label>
        <div className="rv-compose__foot">
          <small />
          <button type="button" className="k-btn" onClick={onCancel}>
            Keep marking up
          </button>
          <button type="submit" className="k-btn k-btn--pri" disabled={busy}>
            {busy ? "Sending…" : "Send"}
          </button>
        </div>
      </form>
    </div>
  );
}
