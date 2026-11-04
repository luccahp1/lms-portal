import Link from "next/link";
import type { Tone } from "@/lib/format";

// Built on the shared LMS kit (src/kit/kit.css), so pages here match LMS Dash.
export function PageHeader({
  title,
  subtitle,
  kicker,
  actions,
}: {
  title: string;
  subtitle?: string;
  kicker?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="k-ph" style={{ marginBottom: 0 }}>
      <div>
        {kicker && <div className="k-ph__k k-mono">{kicker}</div>}
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="k-acts">{actions}</div>}
    </header>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`k-card k-card--still k-reveal ${className}`}>{children}</section>;
}

export function CardTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="font-display text-base font-bold">{children}</h2>
      {action}
    </div>
  );
}

const toneClass: Record<Tone, string> = {
  good: "k-pill--good",
  warn: "k-pill--warn",
  info: "k-pill--jay",
  neutral: "k-pill--mute",
};

export function Pill({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return <span className={`k-pill ${toneClass[tone]}`}>{children}</span>;
}

const buttonBase = "k-btn disabled:opacity-60 cursor-pointer";
const buttonVariant = {
  primary: "k-btn--pri",
  secondary: "",
  ghost: "k-btn--ghost !px-0 !min-h-8 !text-accent hover:underline",
  danger: "!text-bad hover:!border-bad",
};

type Variant = keyof typeof buttonVariant;

/** Button look for plain <a> tags, e.g. links that open a new tab or hit a route handler. */
export function buttonClass(variant: Variant = "primary") {
  return `${buttonBase} ${buttonVariant[variant]}`;
}

export function Button({
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button className={`${buttonBase} ${buttonVariant[variant]} ${className}`} {...props} />;
}

export function ButtonLink({
  variant = "primary",
  className = "",
  ...props
}: React.ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={`${buttonBase} ${buttonVariant[variant]} ${className}`} {...props} />;
}

const inputClass =
  "w-full rounded-lg border border-line-strong bg-surface px-3 py-2 font-normal text-ink placeholder:text-muted/70";

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5 font-medium">
      {label}
      {children}
      {hint && <span className="text-xs font-normal text-muted">{hint}</span>}
    </label>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${inputClass} min-h-10`} {...props} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={3} className={`${inputClass} resize-y`} {...props} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`${inputClass} min-h-10`} {...props} />;
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-6 text-center text-muted">{children}</p>;
}

export function Avatar({ text, accent = false }: { text: string; accent?: boolean }) {
  return (
    <div
      className={`flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
        accent ? "bg-accent/10 text-accent" : "bg-subtle text-ink-2"
      }`}
    >
      {text}
    </div>
  );
}

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-lg bg-bad-bg px-3 py-2 text-bad">
      {message}
    </p>
  );
}
