import Link from "next/link";
import type { Tone } from "@/lib/format";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-[15px] text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-[14px] border border-line bg-surface p-6 ${className}`}>{children}</section>;
}

export function CardTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-base font-semibold">{children}</h2>
      {action}
    </div>
  );
}

const toneClass: Record<Tone, string> = {
  good: "bg-good-bg text-good",
  warn: "bg-warn-bg text-warn",
  info: "bg-info-bg text-info",
  neutral: "bg-subtle text-ink-2",
};

export function Pill({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span className={`inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${toneClass[tone]}`}>
      {children}
    </span>
  );
}

const buttonBase =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 font-medium transition-colors disabled:opacity-60 cursor-pointer";
const buttonVariant = {
  primary: "bg-accent text-white hover:opacity-90",
  secondary: "border border-[#e2e2e7] bg-surface text-ink hover:bg-subtle",
  ghost: "text-accent hover:underline px-0 min-h-8",
  danger: "border border-[#e2e2e7] bg-surface text-[#b42318] hover:bg-[#fef3f2]",
};

type Variant = keyof typeof buttonVariant;

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
    <p role="alert" className="rounded-lg bg-[#fef3f2] px-3 py-2 text-[#b42318]">
      {message}
    </p>
  );
}
