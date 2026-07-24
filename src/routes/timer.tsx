import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { habitColor, isCheckedToday, toggleCheckin, useDb, useMounted } from "@/lib/habits";
import { playCheckinFx } from "@/lib/fx";

export const Route = createFileRoute("/timer")({ component: TimerPage });

const PRESETS = [
  { label: "Quick · 10m", sec: 10 * 60 },
  { label: "Pomodoro · 25m", sec: 25 * 60 },
  { label: "Focus · 50m", sec: 50 * 60 },
  { label: "Deep work · 90m", sec: 90 * 60 },
];

function TimerPage() {
  const db = useDb();
  const mounted = useMounted();

  const [duration, setDuration] = useState(25 * 60);
  const [remaining, setRemaining] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [linkedHabitId, setLinkedHabitId] = useState<string>("");

  // On mount, read sessionStorage hint (set from command palette)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hint = sessionStorage.getItem("grovv.timer.preset");
    if (hint) {
      const sec = parseInt(hint, 10);
      if (!isNaN(sec) && sec > 0) {
        setDuration(sec);
        setRemaining(sec);
      }
      sessionStorage.removeItem("grovv.timer.preset");
    }
  }, []);

  // When linked habit changes and has a default timer, apply it (only if not running)
  useEffect(() => {
    if (running) return;
    if (!linkedHabitId) return;
    const h = db.habits.find((x) => x.id === linkedHabitId);
    if (!h?.defaultTimerMin) return;
    const sec = h.defaultTimerMin * 60;
    setDuration(sec);
    setRemaining(sec);
  }, [linkedHabitId, db.habits, running]);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          setRunning(false);
          if ("Notification" in window && Notification.permission === "granted") {
            new Notification("Focus session complete", {
              body: "Take a short break and come back stronger.",
            });
          }
          // auto check-in if linked & not already done
          if (linkedHabitId) {
            const alreadyDone = isCheckedToday(db, linkedHabitId);
            if (!alreadyDone) {
              toggleCheckin(linkedHabitId);
              if (typeof window !== "undefined") {
                playCheckinFx(window.innerWidth / 2, window.innerHeight / 2, {
                  size: 800,
                  confetti: 28,
                });
              }
            }
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [running, linkedHabitId, db]);

  const mmss = useMemo(() => {
    const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
    const ss = String(remaining % 60).padStart(2, "0");
    return `${mm}:${ss}`;
  }, [remaining]);

  const progress = duration > 0 ? Math.round(((duration - remaining) / duration) * 100) : 0;
  const linkedHabit = db.habits.find((h) => h.id === linkedHabitId);

  if (!mounted) return <AppShell>{null}</AppShell>;

  return (
    <AppShell>
      <PageHeader
        eyebrow="Focus mode"
        title={
          <>
            Built-in <span className="text-gradient">timer</span>
          </>
        }
        subtitle="Pomodoro, deep work, or quick sessions — link to a habit to log automatically."
      />

      <div className="max-w-2xl space-y-4">
        <section
          className="rounded-3xl border border-border bg-[var(--surface)] p-6 sm:p-10 text-center relative overflow-hidden"
          style={
            linkedHabit
              ? {
                  background: `linear-gradient(180deg, color-mix(in oklab, ${habitColor(linkedHabit.color)} 6%, var(--surface)), var(--surface))`,
                }
              : {}
          }
        >
          {linkedHabit && (
            <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground mb-2">
              Working on{" "}
              <span className="font-semibold text-foreground">
                {linkedHabit.icon} {linkedHabit.name}
              </span>
            </div>
          )}
          <p
            className="font-display tabular-nums"
            style={{ fontSize: "clamp(3.5rem, 12vw, 6rem)", lineHeight: 1 }}
          >
            {mmss}
          </p>
          <div className="mt-5 h-2 rounded-full bg-[var(--surface-2)] overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{
                width: `${Math.min(100, progress)}%`,
                background: linkedHabit ? habitColor(linkedHabit.color) : "var(--primary)",
              }}
            />
          </div>
          <div className="mt-6 flex justify-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setRunning((v) => !v)}
              className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:shadow-glow transition-all"
            >
              {running ? "Pause" : "Start"}
            </button>
            <button
              type="button"
              onClick={() => {
                setRunning(false);
                setRemaining(duration);
              }}
              className="rounded-full border border-border px-6 py-3 text-sm font-semibold"
            >
              Reset
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-[var(--surface)] p-5">
          <h3 className="font-display text-lg">Presets</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => {
                  setDuration(preset.sec);
                  setRemaining(preset.sec);
                  setRunning(false);
                }}
                className={
                  "rounded-full border px-4 py-2 text-sm transition-colors " +
                  (duration === preset.sec
                    ? "border-primary/60 bg-primary/15"
                    : "border-border bg-[var(--surface-2)]")
                }
              >
                {preset.label}
              </button>
            ))}
          </div>
        </section>

        {db.habits.length > 0 && (
          <section className="rounded-2xl border border-border bg-[var(--surface)] p-5">
            <h3 className="font-display text-lg">Link to a habit</h3>
            <p className="text-sm text-muted-foreground">
              When the session finishes, this habit will be marked done for today. Habits with their
              own timer preset will auto-set the duration.
            </p>
            <select
              value={linkedHabitId}
              onChange={(e) => setLinkedHabitId(e.target.value)}
              className="mt-3 rounded-lg border border-border bg-[var(--surface-2)] px-3 py-2 text-sm w-full sm:w-auto"
            >
              <option value="">No linked habit</option>
              {db.habits.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.icon} {h.name}
                  {h.defaultTimerMin ? ` · ${h.defaultTimerMin}m` : ""}
                </option>
              ))}
            </select>
          </section>
        )}
      </div>
    </AppShell>
  );
}
