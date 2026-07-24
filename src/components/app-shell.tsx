import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { useDb, completionRate, streakFor } from "@/lib/habits";
import { useReminderEngine } from "@/lib/reminders";
import { CommandPalette } from "@/components/command-palette";
import { resolveTheme, toggleTheme, useThemeSync } from "@/lib/theme";
import { displayNameOf, useAuth } from "@/lib/auth";
import { useCloudSync } from "@/lib/sync";
import { initSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { registerPwa } from "@/lib/pwa";

const NAV = [
  { to: "/", label: "Home", icon: "✦" },
  { to: "/habits", label: "Habits", icon: "◎" },
  { to: "/analytics", label: "Analytics", icon: "▢" },
  { to: "/wellness", label: "Wellness", icon: "♡" },
  { to: "/photos", label: "Photos", icon: "📷" },
  { to: "/timer", label: "Timer", icon: "⏱" },
  { to: "/account", label: "Account", icon: "◐" },
  { to: "/settings", label: "Settings", icon: "⚙" },
] as const;

const MOBILE_NAV = [
  { to: "/", label: "Home", icon: "✦" },
  { to: "/habits", label: "Habits", icon: "◎" },
  { to: "/photos", label: "Photos", icon: "📷" },
  { to: "/wellness", label: "You", icon: "♡" },
  { to: "/settings", label: "More", icon: "≡" },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const loc = useLocation();
  const navigate = useNavigate();
  const db = useDb();
  const auth = useAuth();
  useReminderEngine(db);
  useThemeSync(db.profile.theme);
  useCloudSync();

  useEffect(() => {
    void initSupabase();
    registerPwa();
  }, []);

  // Tell the early boot script that React hydrated successfully.
  useEffect(() => {
    (window as Window & { __GROVV_ALIVE__?: number }).__GROVV_ALIVE__ = 1;
    const rescue = document.getElementById("grovv-boot-rescue");
    if (rescue) rescue.remove();
  }, []);

  // Recover from stale deployments: if a lazy-loaded chunk 404s after a
  // redeploy, reload once (the boot script enforces the once-per-tab cap).
  useEffect(() => {
    const onPreloadError = (event: Event) => {
      event.preventDefault();
      const KEY = "grovv.boot.reload";
      if (sessionStorage.getItem(KEY)) return;
      sessionStorage.setItem(KEY, "1");
      const url = new URL(window.location.href);
      url.searchParams.set("_r", String(Date.now()));
      window.location.replace(url.toString());
    };
    window.addEventListener("vite:preloadError", onPreloadError);
    return () => window.removeEventListener("vite:preloadError", onPreloadError);
  }, []);

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shellStuck, setShellStuck] = useState(false);
  const topStreak = db.habits.map((h) => streakFor(db, h.id)).reduce((a, b) => Math.max(a, b), 0);

  // If a page renders the shell with empty content (SSR/hydration gap) and
  // never fills in, surface a recovery action instead of an endless blank.
  useEffect(() => {
    if (children) {
      setShellStuck(false);
      return;
    }
    const id = window.setTimeout(() => setShellStuck(true), 3500);
    return () => window.clearTimeout(id);
  }, [children]);

  // Route gating: splash/onboarding first, then a required sign-in.
  useEffect(() => {
    const preOnboarding = new Set(["/splash", "/onboarding", "/account"]);
    if (!db.profile.onboardingCompleted) {
      if (!preOnboarding.has(loc.pathname)) void navigate({ to: "/splash" });
      return;
    }
    // Onboarding done -> account is required (when cloud is configured).
    if (
      isSupabaseConfigured() &&
      auth.status === "ready" &&
      !auth.user &&
      loc.pathname !== "/account"
    ) {
      void navigate({ to: "/account" });
    }
  }, [db.profile.onboardingCompleted, auth.status, auth.user, loc.pathname, navigate]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
      if (e.key === "Escape") {
        setPaletteOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const themeResolved = resolveTheme(db.profile.theme);
  const onToggleTheme = () => toggleTheme(db.profile.theme);
  const accountInitial = (displayNameOf(auth.user) || auth.user?.email || db.profile.name || "?")
    .slice(0, 1)
    .toUpperCase();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-[1400px] gap-0 lg:gap-8 lg:px-8 lg:py-8">
        {/* Sidebar — desktop */}
        <aside className="hidden lg:flex flex-col w-60 shrink-0 sticky top-8 self-start h-[calc(100vh-4rem)] rounded-2xl border border-border bg-[var(--surface)] p-5">
          <div className="flex items-center justify-between mb-8">
            <Link to="/" className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-primary animate-pulse" />
              <span className="font-display font-extrabold text-lg tracking-tight">Grovv</span>
            </Link>
            <ThemeToggle resolved={themeResolved} onClick={onToggleTheme} />
          </div>

          <nav className="flex flex-col gap-1 flex-1 overflow-y-auto -mx-1 px-1">
            {NAV.map((item) => {
              const active =
                item.to === "/" ? loc.pathname === "/" : loc.pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors " +
                    (active
                      ? "bg-[var(--surface-2)] text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-[var(--surface-2)]/60")
                  }
                >
                  <span
                    className={
                      "inline-flex size-7 items-center justify-center rounded-lg text-xs " +
                      (active
                        ? "bg-primary/15 text-[var(--primary-soft)]"
                        : "bg-[var(--surface-2)] text-muted-foreground")
                    }
                  >
                    {item.icon}
                  </span>
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="mb-3 w-full rounded-xl border border-border bg-[var(--surface-2)] px-3 py-2 text-left text-xs text-muted-foreground hover:border-primary/40 transition-colors flex items-center justify-between"
          >
            <span>Quick action</span>
            <kbd className="rounded bg-background px-1.5 py-0.5 font-mono text-[0.65rem] border border-border">
              ⌘K
            </kbd>
          </button>

          <div className="rounded-xl border border-border bg-[var(--surface-2)] p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[0.65rem] uppercase tracking-[0.12em] text-muted-foreground">
                Top streak
              </span>
              <span className="text-[var(--warning)]">🔥</span>
            </div>
            <div className="font-display text-2xl font-bold leading-none">{topStreak}</div>
            <div className="text-xs text-muted-foreground mt-1">days in a row</div>
            <div className="mt-3 text-[0.7rem] text-muted-foreground">
              Today: {completionRate(db, 1)}% complete
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 min-w-0 px-4 py-5 sm:py-6 lg:px-0 lg:py-0 pb-28 lg:pb-0">
          {/* Mobile top bar */}
          <div
            className="lg:hidden flex items-center justify-between mb-5 gap-2"
            style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
          >
            <Link to="/" className="flex items-center gap-2 min-w-0">
              <span className="size-2 rounded-full bg-primary animate-pulse shrink-0" />
              <span className="font-display font-extrabold text-base tracking-tight truncate">
                Grovv
              </span>
            </Link>
            <div className="flex items-center gap-1.5 shrink-0">
              <ThemeToggle resolved={themeResolved} onClick={onToggleTheme} />
              <Link
                to="/account"
                aria-label={auth.user ? "Account" : "Sign in"}
                title={auth.user ? displayNameOf(auth.user) || "Account" : "Sign in"}
                className={
                  "relative size-9 grid place-items-center rounded-full border transition-colors " +
                  (auth.user
                    ? "border-[color:var(--success)]/50 bg-[color:var(--success)]/10 text-[color:var(--success)] font-display font-bold text-sm"
                    : "border-border bg-[var(--surface)] text-muted-foreground hover:border-primary/40")
                }
              >
                {auth.user ? accountInitial : "◐"}
                {!auth.user && (
                  <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-[color:var(--warning)]" />
                )}
              </Link>
              <button
                type="button"
                onClick={() => setPaletteOpen(true)}
                aria-label="Open quick actions"
                className="rounded-full border border-border bg-[var(--surface)] size-9 grid place-items-center text-base hover:border-primary/40 transition-colors"
              >
                ⌘
              </button>
            </div>
          </div>
          {children ?? (
            <div className="rounded-2xl border border-border bg-[var(--surface)] p-8 sm:p-10 text-center max-w-lg">
              <div className="mx-auto mb-4 size-10 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
              <p className="font-display text-lg font-semibold">Loading your space…</p>
              <p className="mt-2 text-sm text-muted-foreground">
                {shellStuck
                  ? "This is taking longer than usual — often an old cached page. Refresh to load the latest Grovv."
                  : "Just a moment."}
              </p>
              {shellStuck && (
                <button
                  type="button"
                  onClick={() => {
                    const KEY = "grovv.boot.reload";
                    try {
                      sessionStorage.removeItem(KEY);
                    } catch {
                      /* ignore */
                    }
                    try {
                      sessionStorage.setItem(KEY, "1");
                    } catch {
                      /* ignore */
                    }
                    const url = new URL(window.location.href);
                    url.searchParams.set("_r", String(Date.now()));
                    window.location.replace(url.toString());
                  }}
                  className="mt-5 inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
                >
                  Refresh once
                </button>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav
        className="lg:hidden fixed bottom-2 left-2 right-2 z-50 rounded-2xl border border-border bg-[var(--surface)]/95 backdrop-blur-xl px-1 py-1 flex justify-around shadow-[0_8px_30px_rgba(0,0,0,0.08)]"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom, 0px), 0.25rem)" }}
      >
        {MOBILE_NAV.map((item) => {
          const active = item.to === "/" ? loc.pathname === "/" : loc.pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={
                "flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl text-[0.6rem] transition-all flex-1 min-w-0 " +
                (active
                  ? "text-foreground bg-[var(--surface-2)]"
                  : "text-muted-foreground active:bg-[var(--surface-2)]/60")
              }
            >
              <span className="text-base leading-none">{item.icon}</span>
              <span className="font-medium truncate w-full text-center">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}

function ThemeToggle({ resolved, onClick }: { resolved: "light" | "dark"; onClick: () => void }) {
  const isDark = resolved === "dark";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="rounded-full border border-border bg-[var(--surface)] size-9 grid place-items-center hover:border-primary/40 hover:bg-[var(--surface-2)] transition-colors"
    >
      {isDark ? (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2" />
          <path d="M12 20v2" />
          <path d="m4.93 4.93 1.41 1.41" />
          <path d="m17.66 17.66 1.41 1.41" />
          <path d="M2 12h2" />
          <path d="M20 12h2" />
          <path d="m4.93 19.07 1.41-1.41" />
          <path d="m17.66 6.34 1.41-1.41" />
        </svg>
      ) : (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 flex-wrap mb-5 lg:mb-8">
      <div className="min-w-0 flex-1">
        {eyebrow && (
          <p className="text-[0.65rem] sm:text-[0.7rem] font-medium tracking-[0.14em] uppercase text-primary mb-1.5 sm:mb-2">
            {eyebrow}
          </p>
        )}
        <h1 className="font-display text-[1.7rem] leading-tight sm:text-3xl lg:text-4xl font-bold">
          {title}
        </h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-2 max-w-xl">{subtitle}</p>}
      </div>
      {actions && <div className="flex gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}
