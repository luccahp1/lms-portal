"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, Copy, LoaderCircle, RefreshCw, X } from "lucide-react";
import Link from "next/link";
import { forwardRef, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { avatarColor, initials, STATUS_LABEL } from "@/settled/lib/format";
import type { InvoiceStatus } from "@/settled/lib/types";
import { CheckDraw, spring } from "@/settled/ui/motion";

/** Dialogs, the palette and toasts render here: on <body> (clear of any transformed parent), inside .stl for the styles. */
export function stlLayer(): HTMLElement {
  let el = document.getElementById("stl-layer");
  if (!el) {
    el = document.createElement("div");
    el.id = "stl-layer";
    el.className = "stl";
    document.body.appendChild(el);
  }
  return el;
}

/* ── Button ─────────────────────────────────────────────── */

type BtnVariant = "primary" | "ghost" | "danger" | "default";
interface BtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BtnVariant;
  size?: "sm" | "lg";
  busy?: boolean;
  icon?: React.ReactNode;
  block?: boolean;
  iconOnly?: boolean;
}

function btnClass(variant: BtnVariant = "default", size?: "sm" | "lg", block?: boolean, iconOnly?: boolean, extra?: string) {
  return ["btn", variant !== "default" && "btn-" + variant, size && "btn-" + size, block && "btn-block", iconOnly && "btn-icon", extra].filter(Boolean).join(" ");
}

export const Button = forwardRef<HTMLButtonElement, BtnProps>(function Button(
  { variant, size, busy, icon, block, iconOnly, className, children, disabled, type = "button", ...rest },
  ref,
) {
  return (
    <button ref={ref} type={type} className={btnClass(variant, size, block, iconOnly, className)} disabled={disabled || busy} aria-busy={busy || undefined} {...rest}>
      {busy ? <LoaderCircle className="spin" aria-hidden /> : icon}
      {children}
    </button>
  );
});

export function ButtonLink({
  href,
  variant,
  size,
  icon,
  block,
  children,
  className,
  ...rest
}: { href: string; variant?: BtnVariant; size?: "sm" | "lg"; icon?: React.ReactNode; block?: boolean; children?: React.ReactNode; className?: string } & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href">) {
  return (
    <Link href={href} className={btnClass(variant, size, block, false, className)} {...rest}>
      {icon}
      {children}
    </Link>
  );
}

/* ── Form fields ────────────────────────────────────────── */

export function Field({
  label,
  hint,
  error,
  children,
  htmlFor,
  className,
}: {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: string | null;
  children: React.ReactNode;
  htmlFor?: string;
  className?: string;
}) {
  return (
    <div className={"field " + (className ?? "")}>
      {label ? <label htmlFor={htmlFor}>{label}</label> : null}
      {children}
      {error ? (
        <span className="field-error" role="alert">
          {error}
        </span>
      ) : hint ? (
        <span className="hint">{hint}</span>
      ) : null}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { label?: React.ReactNode; hint?: React.ReactNode; error?: string | null; wrapClass?: string }>(
  function Input({ label, hint, error, id, className, wrapClass, ...rest }, ref) {
    const auto = useId();
    const fid = id ?? auto;
    return (
      <Field label={label} hint={hint} error={error} htmlFor={fid} className={wrapClass}>
        <input ref={ref} id={fid} className={"input " + (className ?? "")} aria-invalid={error ? true : undefined} {...rest} />
      </Field>
    );
  },
);

export function Switch({ checked, onChange, label, disabled, id }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean; id?: string }) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className="switch"
      onClick={() => onChange(!checked)}
    />
  );
}

/* ── Status pill with the Paid moment ───────────────────── */

/**
 * The invoice status pill. When it changes to paid while on screen, the colour
 * morphs to green, a check draws itself and one soft glow pulses out. That is
 * the moment the product is built around.
 */
export function StatusPill({ status, size, days }: { status: InvoiceStatus | string; size?: "lg"; days?: number }) {
  const first = useRef(true);
  const prev = useRef(status);
  const [celebrate, setCelebrate] = useState(false);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (first.current) {
      first.current = false;
      prev.current = status;
      return;
    }
    if (status === "paid" && prev.current !== "paid") {
      setCelebrate(true);
      const t = setTimeout(() => setCelebrate(false), 1500);
      prev.current = status;
      return () => clearTimeout(t);
    }
    prev.current = status;
  }, [status]);

  const label = status === "overdue" && days ? `${days}d overdue` : STATUS_LABEL[status] ?? status;
  return (
    <motion.span
      layout={!reduce}
      transition={spring}
      className={["pill", size === "lg" && "pill-lg", status === "incoming" && "pill-incoming", celebrate && "paid-glow"].filter(Boolean).join(" ")}
      data-s={status}
    >
      {status === "paid" ? (
        <CheckDraw size={size === "lg" ? 15 : 13} play={celebrate} />
      ) : (
        <span className="pill-dot" aria-hidden />
      )}
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span key={label} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.22 }}>
          {label}
        </motion.span>
      </AnimatePresence>
    </motion.span>
  );
}

export function Pill({ tone = "neutral", children, icon }: { tone?: string; children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <span className="pill" data-s={tone}>
      {icon ?? <span className="pill-dot" aria-hidden />}
      {children}
    </span>
  );
}

/* ── Avatar ─────────────────────────────────────────────── */

export function Avatar({ name, size }: { name: string; size?: "sm" | "lg" }) {
  return (
    <span className={"avatar " + (size ? "avatar-" + size : "")} style={{ ["--av" as string]: avatarColor(name) }} aria-hidden>
      {initials(name)}
    </span>
  );
}

/* ── Skeleton ───────────────────────────────────────────── */

export function Sk({ w = "100%", h = 14, r, style }: { w?: number | string; h?: number | string; r?: number; style?: React.CSSProperties }) {
  return <span className="sk" style={{ width: w, height: h, borderRadius: r, ...style }} aria-hidden />;
}

export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="list" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div className="list-row" key={i}>
          <Sk w={36} h={36} r={18} />
          <div className="cell-main stack-sm" style={{ gap: 6 }}>
            <Sk w={`${50 + ((i * 17) % 30)}%`} h={13} />
            <Sk w={`${25 + ((i * 11) % 20)}%`} h={11} />
          </div>
          <Sk w={70} h={14} />
        </div>
      ))}
    </div>
  );
}

/* ── Empty and error ────────────────────────────────────── */

export function Empty({ icon, title, children, action }: { icon: React.ReactNode; title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <motion.div className="empty" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <div className="empty-art">{icon}</div>
      <h3>{title}</h3>
      {children ? <p>{children}</p> : null}
      {action}
    </motion.div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="empty" role="alert">
      <div className="empty-art" style={{ background: "var(--danger-soft)", color: "var(--danger)" }}>
        <RefreshCw />
      </div>
      <h3>That did not load</h3>
      <p>{message}</p>
      {onRetry ? (
        <Button onClick={onRetry} icon={<RefreshCw />}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}

/* ── Copy ───────────────────────────────────────────────── */

export function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (text: string, key = text) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(key);
    setTimeout(() => setCopied((c) => (c === key ? null : c)), 1600);
  };
  return { copied, copy };
}

export function CopyButton({ text, label = "Copy", size = "sm", variant }: { text: string; label?: string; size?: "sm" | "lg"; variant?: BtnVariant }) {
  const { copied, copy } = useCopy();
  const on = copied === text;
  return (
    <Button size={size} variant={variant} onClick={() => copy(text)} aria-label={on ? "Copied" : label + ": " + text}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={on ? "y" : "n"}
          className="hstack"
          style={{ gap: 6 }}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.14 }}
        >
          {on ? <Check style={{ color: "var(--primary-text)" }} /> : <Copy />}
          {on ? "Copied" : label}
        </motion.span>
      </AnimatePresence>
    </Button>
  );
}

export function CopyField({ value, label }: { value: string; label?: string }) {
  return (
    <div className="copy">
      <code title={value}>{value}</code>
      <CopyButton text={value} label={label ?? "Copy"} />
    </div>
  );
}

/* ── Dialog (bottom sheet on phones) ────────────────────── */

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const tid = useId();
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const before = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
      if (e.key === "Tab" && ref.current) {
        const f = ref.current.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])');
        if (!f.length) return;
        const firstEl = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === firstEl) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    const t = setTimeout(() => {
      const target = ref.current?.querySelector<HTMLElement>("[data-autofocus], input, select, textarea, button.btn-primary") ?? ref.current;
      target?.focus();
    }, 30);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      before?.focus?.();
    };
  }, [open, onClose]);

  if (!mounted) return null;
  return createPortal(
    <AnimatePresence>
      {open ? (
        <>
          <motion.div key="ov" className="overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} onClick={onClose} />
          <div className="dialog-wrap" key="wrap">
            <motion.div
              ref={ref}
              role="dialog"
              aria-modal="true"
              aria-labelledby={tid}
              tabIndex={-1}
              className={"dialog" + (wide ? " wide" : "")}
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98, transition: { duration: 0.16 } }}
              transition={spring}
            >
              <div className="grab" aria-hidden />
              <div className="dialog-head">
                <div>
                  <h2 id={tid}>{title}</h2>
                  {description ? <p>{description}</p> : null}
                </div>
                <Button variant="ghost" size="sm" iconOnly onClick={onClose} aria-label="Close">
                  <X />
                </Button>
              </div>
              {children}
              {footer ? <div className="dialog-foot">{footer}</div> : null}
            </motion.div>
          </div>
        </>
      ) : null}
    </AnimatePresence>,
    stlLayer(),
  );
}

/* ── Tabs and chips with a sliding indicator ────────────── */

export function Tabs<T extends string>({
  value,
  onChange,
  items,
  label,
  id = "tabs",
}: {
  value: T;
  onChange: (v: T) => void;
  items: { value: T; label: React.ReactNode; badge?: number | null }[];
  label: string;
  id?: string;
}) {
  const onKey = (e: React.KeyboardEvent, i: number) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const n = (i + (e.key === "ArrowRight" ? 1 : -1) + items.length) % items.length;
    onChange(items[n].value);
    (e.currentTarget.parentElement?.children[n] as HTMLElement | undefined)?.focus();
  };
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {items.map((it, i) => (
        <button
          key={it.value}
          role="tab"
          type="button"
          className="tab"
          aria-selected={value === it.value}
          tabIndex={value === it.value ? 0 : -1}
          onClick={() => onChange(it.value)}
          onKeyDown={(e) => onKey(e, i)}
        >
          {it.label}
          {it.badge ? <span className="tab-badge num">{it.badge}</span> : null}
          {value === it.value ? <motion.span className="tab-line" layoutId={id + "-line"} transition={spring} /> : null}
        </button>
      ))}
    </div>
  );
}

export function Chips<T extends string>({
  value,
  onChange,
  items,
  label,
  id = "chips",
  scroll,
}: {
  value: T;
  onChange: (v: T) => void;
  items: { value: T; label: string; count?: number }[];
  label: string;
  id?: string;
  scroll?: boolean;
}) {
  return (
    <div className={"chips" + (scroll ? " chips-scroll" : "")} role="group" aria-label={label}>
      {items.map((it) => (
        <button key={it.value} type="button" className="chip" aria-pressed={value === it.value} onClick={() => onChange(it.value)}>
          {value === it.value ? <motion.span className="chip-bg" layoutId={id + "-bg"} transition={spring} /> : null}
          <span>{it.label}</span>
          {it.count !== undefined ? <span className="chip-count num">{it.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

/* ── Menu (row actions) ─────────────────────────────────── */

export function Menu({ trigger, children, align = "right" }: { trigger: (p: { open: boolean; toggle: () => void; ref: React.Ref<HTMLButtonElement> }) => React.ReactNode; children: (close: () => void) => React.ReactNode; align?: "left" | "right" }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        btn.current?.focus();
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const items = Array.from(box.current?.querySelectorAll<HTMLElement>(".menu-item") ?? []);
        const i = items.indexOf(document.activeElement as HTMLElement);
        const n = e.key === "ArrowDown" ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
        items[n]?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    setTimeout(() => box.current?.querySelector<HTMLElement>(".menu-item")?.focus(), 20);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div ref={box} style={{ position: "relative" }}>
      {trigger({ open, toggle: () => setOpen((o) => !o), ref: btn })}
      <AnimatePresence>
        {open ? (
          <motion.div
            className="menu"
            role="menu"
            style={{ [align]: 0, top: "calc(100% + 6px)" }}
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97, transition: { duration: 0.12 } }}
            transition={{ duration: 0.16 }}
          >
            {children(() => setOpen(false))}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/* ── Page header ────────────────────────────────────────── */

export function PageHead({ title, sub, actions, back }: { title: React.ReactNode; sub?: React.ReactNode; actions?: React.ReactNode; back?: React.ReactNode }) {
  return (
    <header className="page-head">
      <div className="grow">
        {back}
        <h1>{title}</h1>
        {sub ? <p className="page-sub">{sub}</p> : null}
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </header>
  );
}
