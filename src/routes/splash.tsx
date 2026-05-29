import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { useDb, useMounted } from "@/lib/habits";

export const Route = createFileRoute("/splash")({ component: SplashPage });

function SplashPage() {
  const db = useDb();
  const mounted = useMounted();
  const navigate = useNavigate();

  useEffect(() => {
    if (!mounted) return;
    if (db.profile.onboardingCompleted) {
      void navigate({ to: "/" });
    }
  }, [db.profile.onboardingCompleted, mounted, navigate]);

  const sparkles = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        id: i,
        left: `${Math.random() * 90 + 5}%`,
        top: `${Math.random() * 80 + 5}%`,
        delay: `${(Math.random() * 3).toFixed(2)}s`,
        scale: 0.6 + Math.random() * 1.2,
      })),
    [],
  );

  if (!mounted) return null;

  return (
    <div className="grovv-splash min-h-screen text-foreground px-4 py-12 sm:py-16 grid place-items-center">
      <div className="grovv-blob b1" />
      <div className="grovv-blob b2" />
      <div className="grovv-blob b3" />

      {sparkles.map((s) => (
        <span
          key={s.id}
          className="grovv-sparkle"
          style={{
            left: s.left,
            top: s.top,
            animationDelay: s.delay,
            transform: `scale(${s.scale})`,
          }}
        />
      ))}

      <div className="relative w-full max-w-2xl text-center">
        {/* Animated growing seed */}
        <div className="relative mx-auto mb-8 grid place-items-center">
          <div className="grovv-seed">
            <div className="grovv-leaf l1" />
            <div className="grovv-leaf l2" />
          </div>
        </div>

        <div className="grovv-fade-up" style={{ animationDelay: "0.1s" }}>
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-[var(--surface)]/60 backdrop-blur-md px-4 py-1.5 text-xs uppercase tracking-[0.18em] text-primary font-semibold">
            <span className="size-2 rounded-full bg-primary animate-pulse" />
            Welcome to Grovv
          </div>
        </div>

        <h1
          className="mt-6 font-display font-bold leading-[0.95] tracking-tight grovv-fade-up"
          style={{ fontSize: "clamp(3rem, 9vw, 5.5rem)", animationDelay: "0.25s" }}
        >
          Grow on{" "}
          <span className="text-gradient italic" style={{ fontFamily: "Instrument Serif, serif" }}>
            purpose.
          </span>
        </h1>

        <p
          className="mt-5 mx-auto max-w-md text-base sm:text-lg text-foreground/70 grovv-fade-up"
          style={{ animationDelay: "0.4s" }}
        >
          Habits, mood, focus, and a private journal — wrapped in one calm space.
        </p>

        <div
          className="mt-10 grid gap-2 sm:grid-cols-2 max-w-lg mx-auto grovv-fade-up"
          style={{ animationDelay: "0.55s" }}
        >
          {[
            { e: "🌱", t: "Identity-first habits" },
            { e: "🔔", t: "Smart, adaptive reminders" },
            { e: "📓", t: "Daily journal & wellness" },
            { e: "⏱", t: "Focus timer with check-in" },
          ].map(({ e, t }) => (
            <div
              key={t}
              className="rounded-2xl border border-border/60 bg-[var(--surface)]/70 backdrop-blur-md px-4 py-3 text-sm font-medium text-left flex items-center gap-3"
            >
              <span className="text-xl">{e}</span>
              <span>{t}</span>
            </div>
          ))}
        </div>

        <div
          className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3 grovv-fade-up"
          style={{ animationDelay: "0.7s" }}
        >
          <button
            type="button"
            onClick={() => void navigate({ to: "/onboarding" })}
            className="w-full sm:w-auto rounded-full bg-primary px-7 py-3 text-sm font-semibold text-primary-foreground hover:shadow-glow transition-all hover:-translate-y-0.5"
          >
            Begin growing →
          </button>
          <button
            type="button"
            onClick={() => void navigate({ to: "/" })}
            className="w-full sm:w-auto rounded-full border border-border bg-[var(--surface)]/60 backdrop-blur-md px-7 py-3 text-sm font-semibold text-foreground hover:bg-[var(--surface)] transition-colors"
          >
            Skip intro
          </button>
        </div>

        <p
          className="mt-8 text-xs text-foreground/60 grovv-fade-up"
          style={{ animationDelay: "0.9s" }}
        >
          Works fully offline · sign-in is optional ·{" "}
          <button
            type="button"
            onClick={() => void navigate({ to: "/account" })}
            className="underline underline-offset-2 hover:text-foreground"
          >
            sign in to sync photos
          </button>
        </p>
      </div>
    </div>
  );
}
