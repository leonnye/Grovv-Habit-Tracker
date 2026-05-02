import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { markPremiumPromptShown } from "@/lib/habits";

const FEATURES = [
  { icon: "♡", title: "Wellness & Mood", desc: "Daily mood, sleep, hydration, insights" },
  { icon: "📓", title: "Private Journal", desc: "5,000-character entries with tags" },
  { icon: "⏱", title: "Focus Timer", desc: "Pomodoro / deep work, auto check-in" },
  { icon: "📊", title: "Mood ↔ habit insights", desc: "See what makes you feel best" },
  { icon: "📁", title: "CSV export", desc: "Take your data anywhere, anytime" },
  { icon: "💎", title: "Future updates", desc: "All new Pro features included" },
] as const;

export function PremiumPromptModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    markPremiumPromptShown();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const seePlans = () => {
    onClose();
    void navigate({ to: "/pricing" });
  };

  return (
    <div
      className="fixed inset-0 z-[110] grid place-items-center bg-background/70 backdrop-blur-sm p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="premium-prompt-title"
        className="relative w-full max-w-md rounded-3xl border border-primary/30 bg-[var(--surface)] p-6 sm:p-7 grovv-slide-down overflow-hidden"
      >
        <div
          className="absolute -top-20 -right-16 size-48 rounded-full opacity-30 blur-3xl"
          style={{ background: "var(--gradient-accent)" }}
        />

        <div className="relative">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-[0.65rem] uppercase tracking-[0.16em] text-primary font-semibold">
            <span>💎</span> Grovv Pro
          </div>

          <h2
            id="premium-prompt-title"
            className="mt-3 font-display text-2xl sm:text-3xl font-bold leading-tight"
          >
            Unlock the full <span className="text-gradient">Grovv</span> experience
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            One small upgrade unlocks wellness tracking, journaling, focus timer, and pattern
            insights. Cancel anytime.
          </p>

          <ul className="mt-5 grid grid-cols-2 gap-2">
            {FEATURES.map((f) => (
              <li
                key={f.title}
                className="flex items-start gap-2 rounded-xl border border-border bg-[var(--surface-2)] p-2.5"
              >
                <span className="text-base leading-none mt-0.5">{f.icon}</span>
                <div className="min-w-0">
                  <p className="text-[0.7rem] font-semibold leading-tight">{f.title}</p>
                  <p className="text-[0.6rem] text-muted-foreground leading-tight mt-0.5 truncate">
                    {f.desc}
                  </p>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-5 rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3 flex items-baseline justify-between">
            <div>
              <p className="text-[0.65rem] uppercase tracking-[0.14em] text-primary font-semibold">
                Starts at
              </p>
              <p className="font-display text-2xl font-bold leading-none mt-0.5">
                $1.97 <span className="text-xs text-muted-foreground font-normal">/ month</span>
              </p>
            </div>
            <p className="text-[0.65rem] text-muted-foreground text-right">
              or one-time
              <br />
              lifetime payment
            </p>
          </div>

          <button
            type="button"
            onClick={seePlans}
            className="mt-5 w-full rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:shadow-glow transition-all"
          >
            See plans
          </button>
          <button
            type="button"
            onClick={onClose}
            className="mt-2 w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors py-2"
          >
            I'll pass this time
          </button>
        </div>
      </div>
    </div>
  );
}
