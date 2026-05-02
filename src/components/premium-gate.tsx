import { Link } from "@tanstack/react-router";

export function PremiumGate({
  title,
  description,
  features,
}: {
  title: string;
  description: string;
  features: string[];
}) {
  return (
    <div className="rounded-3xl border border-primary/30 bg-gradient-to-br from-[var(--surface)] to-[var(--surface-2)] p-8 sm:p-10 max-w-2xl">
      <div className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs uppercase tracking-[0.14em] text-primary">
        <span>💎</span> Pro feature
      </div>
      <h2 className="mt-4 font-display text-3xl sm:text-4xl">{title}</h2>
      <p className="mt-2 text-muted-foreground">{description}</p>

      <ul className="mt-6 grid gap-2 sm:grid-cols-2">
        {features.map((f) => (
          <li
            key={f}
            className="flex items-start gap-2 rounded-xl border border-border bg-[var(--surface)] px-3 py-2 text-sm"
          >
            <span className="text-[color:var(--success)]">✓</span>
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <div className="mt-7 flex flex-wrap gap-3">
        <Link
          to="/pricing"
          className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:shadow-glow transition-all"
        >
          Upgrade to Pro
        </Link>
        <Link
          to="/pricing"
          className="rounded-full border border-border px-6 py-3 text-sm font-semibold text-foreground hover:bg-[var(--surface-2)] transition-colors"
        >
          Start 7-day trial
        </Link>
      </div>
    </div>
  );
}
