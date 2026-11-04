/* Sign-in, sign-up and password pages: the brand band, then one card. Same look as LMS Dash. */
export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <>
      <header className="k-band">
        <span className="k-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/mark.svg" alt="" width={30} height={31} />
          <span className="k-brand__text">
            <span className="k-brand__wm">London Marketing Solutions</span>
            <span className="k-brand__sub">Sign in</span>
          </span>
        </span>
      </header>
      <main className="flex min-h-[calc(100vh-61px)] items-start justify-center px-4 py-12 sm:items-center">
        <div className="k-card k-card--still w-full max-w-sm !gap-0 !p-8">
          <h1 className="font-display text-[28px] leading-tight font-extrabold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1 text-muted">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
      </main>
    </>
  );
}
