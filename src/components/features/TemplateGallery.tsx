"use client";

import { useEffect, useRef, useState } from "react";

// The ten site designs as live, scaled-down pages. Clicking one opens it full size with a
// computer / phone switch; `onPick` adds "Choose this design". Used by the public gallery
// (/templates), the start link and the portal's Your project page.

export type GalleryTemplate = { slug: string; name: string; fits: string; blurb: string };

const DESKTOP_W = 1280;
const DESKTOP_H = 820;

function Thumb({ src, title }: { src: string; title: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.25);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = () => setScale(el.clientWidth / DESKTOP_W);
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={box} className="relative w-full overflow-hidden bg-subtle" style={{ aspectRatio: `${DESKTOP_W} / ${DESKTOP_H}` }}>
      <iframe
        src={src}
        title={title}
        loading="lazy"
        tabIndex={-1}
        aria-hidden="true"
        style={{ width: DESKTOP_W, height: DESKTOP_H, border: 0, transform: `scale(${scale})`, transformOrigin: "0 0", pointerEvents: "none" }}
      />
    </div>
  );
}

export function TemplateGallery({
  templates,
  query = "",
  selected,
  onPick,
  busy,
}: {
  templates: GalleryTemplate[];
  /** "?name=...&phone=..." so every design carries this business's own details. */
  query?: string;
  selected?: string | null;
  onPick?: (slug: string) => void;
  busy?: boolean;
}) {
  const [open, setOpen] = useState<GalleryTemplate | null>(null);
  const [phone, setPhone] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {templates.map((t) => {
          const on = selected === t.slug;
          return (
            <article
              key={t.slug}
              className={`flex flex-col overflow-hidden rounded-2xl border bg-surface transition-shadow hover:shadow-lg ${on ? "border-accent ring-2 ring-accent/30" : "border-line"}`}
            >
              <button type="button" onClick={() => setOpen(t)} className="block w-full cursor-zoom-in text-left" aria-label={`Open the ${t.name} design`}>
                <Thumb src={`/templates/${t.slug}${query}`} title={`${t.name} design`} />
              </button>
              <div className="flex flex-1 flex-col gap-1 border-t border-line p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="font-display text-lg font-bold">{t.name}</h3>
                  {on && <span className="k-pill k-pill--good">Your pick</span>}
                </div>
                <p className="text-[13px] font-medium text-ink-2">{t.fits}</p>
                <p className="text-[13px] text-muted">{t.blurb}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" className="k-btn k-btn--sm" onClick={() => setOpen(t)}>
                    Look closer
                  </button>
                  {onPick && !on && (
                    <button type="button" className="k-btn k-btn--sm k-btn--pri" disabled={busy} onClick={() => onPick(t.slug)}>
                      Choose this design
                    </button>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-[var(--band)]" role="dialog" aria-modal="true" aria-label={`${open.name} design`}>
          <div className="flex flex-wrap items-center gap-3 px-4 py-3 text-[var(--band-ink)]">
            <div className="mr-auto min-w-0">
              <div className="font-display text-base font-bold">{open.name}</div>
              <div className="truncate text-xs text-[var(--band-ink-2)]">{open.fits}</div>
            </div>
            <div className="hidden overflow-hidden rounded-lg border border-[var(--band-line)] text-xs font-semibold sm:flex">
              <button type="button" className={`px-3 py-2 ${!phone ? "bg-[var(--band-line)]" : ""}`} onClick={() => setPhone(false)} aria-pressed={!phone}>
                Computer
              </button>
              <button type="button" className={`px-3 py-2 ${phone ? "bg-[var(--band-line)]" : ""}`} onClick={() => setPhone(true)} aria-pressed={phone}>
                Phone
              </button>
            </div>
            {onPick && (
              <button
                type="button"
                className="k-btn k-btn--pri"
                disabled={busy}
                onClick={() => {
                  onPick(open.slug);
                  setOpen(null);
                }}
              >
                {selected === open.slug ? "Keep this design" : "Choose this design"}
              </button>
            )}
            <button type="button" className="k-btn" onClick={() => setOpen(null)}>
              Close
            </button>
          </div>
          <div className="flex min-h-0 flex-1 justify-center overflow-auto bg-[var(--surface-3)] sm:p-4">
            <iframe
              src={`/templates/${open.slug}${query}`}
              title={`${open.name} design, full size`}
              className={phone ? "h-full max-h-[844px] w-[390px] max-w-full rounded-[30px] border-[10px] border-[var(--band)] bg-white" : "h-full w-full bg-white sm:rounded-xl"}
            />
          </div>
        </div>
      )}
    </>
  );
}
