import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import type { MouseEvent } from "react";
import { AppShell, PageHeader } from "@/components/app-shell";
import {
  useDb,
  useMounted,
  toggleCheckin,
  isCheckedToday,
  streakFor,
  gridLevels,
  habitColor,
  completionRate,
  weeklyCompletion,
  weeklyReview,
  ymd,
  greetingFor,
  isHabitDueToday,
  type Habit,
} from "@/lib/habits";
import { playCheckinFx } from "@/lib/fx";

export const Route = createFileRoute("/")({ component: TodayPage });

function TodayPage() {
  const db = useDb();
  const mounted = useMounted();
  const navigate = useNavigate();
  const today = new Date();
  const dateLabel = today.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const todayPct = completionRate(db, 1);
  const week = weeklyCompletion(db);
  const todaysWellness = db.wellness[ymd(today)] ?? { date: ymd(today) };
  const review = weeklyReview(db);

  // Featured grid: first habit
  const featured = db.habits[0];
  const cells = featured ? gridLevels(db, featured.id, 14) : [];

  const identities = Array.from(
    new Set(
      [db.profile.identity, ...db.habits.map((h) => h.identity)].filter(
        (s): s is string => typeof s === "string" && Boolean(s.trim()),
      ),
    ),
  );

  const habitMap = new Map(db.habits.map((h) => [h.id, h] as const));
  const isSunday = today.getDay() === 0;

  useEffect(() => {
    if (!mounted) return;
    if (!db.profile.onboardingCompleted) {
      void navigate({ to: "/splash" });
    }
  }, [db.profile.onboardingCompleted, mounted, navigate]);

  if (!mounted) return <AppShell>{null}</AppShell>;

  const greeting = greetingFor(db.profile.name, today);

  const onHabitClick = (event: MouseEvent<HTMLButtonElement>, habit: Habit) => {
    const wasDone = isCheckedToday(db, habit.id);
    toggleCheckin(habit.id);
    if (!wasDone) {
      const rect = event.currentTarget.getBoundingClientRect();
      playCheckinFx(rect.left + rect.width / 2, rect.top + rect.height / 2);
    }
  };

  return (
    <AppShell>
      <PageHeader
        eyebrow={dateLabel}
        title={
          <>
            {greeting},{" "}
            <span className="text-gradient">
              {todayPct === 100 ? "complete" : `${todayPct}% done`}
            </span>
          </>
        }
        subtitle="One tap is all it takes. Tap a habit to log it for today."
      />

      {/* Identity 'becoming' strip */}
      {identities.length > 0 && (
        <div className="mb-6 -mt-3">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scroll-smooth">
            <span className="text-[0.65rem] uppercase tracking-[0.14em] text-muted-foreground shrink-0 mr-1">
              Becoming
            </span>
            {identities.map((id) => (
              <span
                key={id}
                className="shrink-0 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-medium italic"
              >
                I am someone who {id}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Stat strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard
          label="Today"
          value={`${todayPct}%`}
          sub={`${db.habits.length} habits`}
          fill={todayPct}
          fillColor="var(--primary)"
        />
        <StatCard
          label="Best streak"
          value={`${db.habits.reduce((a, h) => Math.max(a, streakFor(db, h.id)), 0)}d`}
          sub="active streak"
          fill={Math.min(100, db.habits.reduce((a, h) => Math.max(a, streakFor(db, h.id)), 0) * 4)}
          fillColor="var(--warning)"
        />
        <StatCard
          label="This week"
          value={`${completionRate(db, 7)}%`}
          sub="last 7 days"
          fill={completionRate(db, 7)}
          fillColor="var(--success)"
        />
        <StatCard
          label="Sleep"
          value={todaysWellness.sleepHours ? `${todaysWellness.sleepHours}h` : "—"}
          sub="last logged"
          fill={Math.min(100, ((todaysWellness.sleepHours ?? 0) / 9) * 100)}
          fillColor="var(--info)"
        />
      </div>

      {isSunday && db.habits.length > 0 && (
        <section className="mb-6 rounded-2xl border border-primary/30 bg-gradient-to-br from-[color:var(--primary)]/8 to-[color:var(--info)]/8 p-5 sm:p-6 grovv-fade-up">
          <div className="flex items-start gap-4 flex-wrap">
            <div className="size-10 rounded-xl bg-primary/15 grid place-items-center text-lg shrink-0">
              📈
            </div>
            <div className="flex-1 min-w-[220px]">
              <p className="text-[0.65rem] uppercase tracking-[0.14em] text-primary font-semibold">
                Sunday review
              </p>
              <h3 className="font-display text-lg font-semibold mt-0.5">
                {review.pct}% week ·{" "}
                {review.bestHabit
                  ? `Best: ${review.bestHabit.habit.icon} ${review.bestHabit.habit.name} (${review.bestHabit.rate}%)`
                  : "Add a few check-ins to see insights"}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">{review.suggestedTweak}</p>
            </div>
          </div>
        </section>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Habit list */}
        <section className="lg:col-span-2 rounded-2xl border border-border bg-[var(--surface)] p-5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-semibold">Today's habits</h2>
            <span className="text-xs text-muted-foreground">
              {db.habits.filter((h) => isCheckedToday(db, h.id)).length}/{db.habits.length} done
            </span>
          </div>

          {db.habits.length === 0 ? (
            <EmptyHabits />
          ) : (
            <ul className="flex flex-col gap-2">
              {db.habits.map((h) => {
                const done = isCheckedToday(db, h.id);
                const streak = streakFor(db, h.id);
                const dueToday = isHabitDueToday(h, today);
                const stackParent = h.stackAfterId ? habitMap.get(h.stackAfterId) : undefined;
                return (
                  <li key={h.id}>
                    <button
                      type="button"
                      aria-pressed={done}
                      onClick={(e) => onHabitClick(e, h)}
                      className={
                        "w-full flex items-center justify-between gap-4 rounded-xl border bg-[var(--surface-2)] px-4 py-3.5 text-left transition-all active:scale-[0.99] " +
                        (done
                          ? "border-[color:var(--success)]/40"
                          : "border-border hover:border-[color:var(--primary)]/40") +
                        (dueToday ? "" : " opacity-60")
                      }
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="size-10 rounded-xl grid place-items-center text-base shrink-0"
                          style={{
                            background: `color-mix(in oklab, ${habitColor(h.color)} 15%, transparent)`,
                          }}
                        >
                          {h.icon}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{h.name}</div>
                          <div className="text-[0.7rem] text-muted-foreground truncate">
                            {streak > 0
                              ? `🔥 ${streak} day${streak === 1 ? "" : "s"}`
                              : "Start your streak"}
                            {stackParent && (
                              <>
                                {" · "}after {stackParent.icon} {stackParent.name}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <span
                        className={
                          "size-7 rounded-full grid place-items-center transition-all shrink-0 " +
                          (done
                            ? "bg-[color:var(--success)] text-background"
                            : "border border-border")
                        }
                      >
                        {done && (
                          <svg
                            viewBox="0 0 24 24"
                            className="size-4"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3"
                          >
                            <path d="M5 12l5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {/* Activity grid for featured */}
          {featured && (
            <div className="mt-6 pt-5 border-t border-border">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <span className="text-xs text-muted-foreground">
                  {featured.name} · last 14 weeks
                </span>
                <span className="text-[0.65rem] text-muted-foreground flex items-center gap-1.5">
                  Less
                  {[0.15, 0.35, 0.6, 1].map((o, i) => (
                    <span
                      key={i}
                      className="size-2.5 rounded-sm"
                      style={{
                        background: `color-mix(in oklab, ${habitColor(featured.color)} ${o * 100}%, transparent)`,
                      }}
                    />
                  ))}
                  More
                </span>
              </div>
              <div className="grid grid-cols-[repeat(14,minmax(0,1fr))] gap-[3px]">
                {cells.map((lvl, i) => (
                  <div
                    key={i}
                    className="aspect-square rounded-[3px]"
                    style={{
                      background: lvl > 0 ? habitColor(featured.color) : "var(--surface-2)",
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Right column */}
        <aside className="flex flex-col gap-6">
          {/* Weekly chart */}
          <div className="rounded-2xl border border-border bg-[var(--surface)] p-5">
            <h3 className="font-display text-sm font-semibold mb-4">This week</h3>
            <div className="flex items-end gap-2 h-28">
              {week.map((d, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                  <div className="w-full h-24 flex items-end">
                    <div
                      className="w-full rounded-t-md transition-all"
                      style={{
                        height: `${Math.max(d.pct, 4)}%`,
                        background: d.pct === 100 ? "var(--success)" : "var(--primary)",
                        opacity: d.pct ? 0.9 : 0.25,
                      }}
                    />
                  </div>
                  <span className="text-[0.6rem] text-muted-foreground">{d.day}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick mood log */}
          <div className="rounded-2xl border border-border bg-[var(--surface)] p-5">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-display text-sm font-semibold">How are you today?</h3>
              <Link
                to="/wellness"
                className="text-[0.65rem] uppercase tracking-[0.1em] text-primary font-semibold"
              >
                Open
              </Link>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              Log your mood and write a note in Wellness.
            </p>
            <div className="flex justify-between gap-1.5">
              {[
                { v: 1, e: "😞" },
                { v: 2, e: "😕" },
                { v: 3, e: "😐" },
                { v: 4, e: "🙂" },
                { v: 5, e: "😄" },
              ].map((m) => {
                const active = todaysWellness.mood === m.v;
                return (
                  <Link
                    key={m.v}
                    to="/wellness"
                    aria-label={`Log mood ${m.v}`}
                    aria-pressed={active}
                    className={
                      "flex-1 aspect-square rounded-xl text-2xl grid place-items-center transition-all border " +
                      (active
                        ? "bg-[color:var(--warning)]/15 border-[color:var(--warning)]/50 scale-105"
                        : "bg-[var(--surface-2)] border-border hover:border-[color:var(--primary)]/40")
                    }
                  >
                    {m.e}
                  </Link>
                );
              })}
            </div>
            <p className="mt-3 text-[0.65rem] text-muted-foreground text-center">
              Wellness is a Pro feature — start a free trial to unlock journaling & insights.
            </p>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}

function StatCard({
  label,
  value,
  sub,
  fill,
  fillColor,
}: {
  label: string;
  value: string;
  sub: string;
  fill: number;
  fillColor: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-[var(--surface)] p-4">
      <div className="text-[0.65rem] uppercase tracking-[0.1em] text-muted-foreground">{label}</div>
      <div className="font-display text-2xl font-bold mt-1" style={{ color: fillColor }}>
        {value}
      </div>
      <div className="text-[0.7rem] text-muted-foreground mt-0.5">{sub}</div>
      <div className="mt-3 h-1 rounded-full bg-[var(--surface-2)] overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.max(0, Math.min(100, fill))}%`, background: fillColor }}
        />
      </div>
    </div>
  );
}

function EmptyHabits() {
  return (
    <div className="text-center py-10">
      <div className="text-3xl mb-2">✨</div>
      <p className="text-sm text-muted-foreground">No habits yet. Add one from the Habits tab.</p>
    </div>
  );
}
