import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { AppShell, PageHeader } from "@/components/app-shell";
import {
  useDb,
  useMounted,
  gridLevels,
  habitColor,
  streakFor,
  bestStreakFor,
  completionRate,
  weeklyCompletion,
  yearGrid,
} from "@/lib/habits";

export const Route = createFileRoute("/analytics")({ component: AnalyticsPage });

function AnalyticsPage() {
  const db = useDb();
  const mounted = useMounted();
  const grid = useMemo(() => yearGrid(db), [db]);
  if (!mounted) return <AppShell>{null}</AppShell>;

  const week = weeklyCompletion(db);
  const total7 = completionRate(db, 7);
  const total30 = completionRate(db, 30);

  const monthLabels = computeMonthLabels(grid);

  return (
    <AppShell>
      <PageHeader
        eyebrow="Insights"
        title={
          <>
            Your <span className="text-gradient">consistency</span>
          </>
        }
        subtitle="See your activity grids, streaks, and completion trends — all in one place."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Metric label="7-day rate" value={`${total7}%`} color="var(--primary)" />
        <Metric label="30-day rate" value={`${total30}%`} color="var(--info)" />
        <Metric label="Active habits" value={db.habits.length.toString()} color="var(--warning)" />
        <Metric
          label="Total check-ins"
          value={Object.values(db.checkins)
            .reduce((a, b) => a + b.length, 0)
            .toString()}
          color="var(--success)"
        />
      </div>

      <section className="rounded-2xl border border-border bg-[var(--surface)] p-5 sm:p-6 mb-6">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="font-display text-base font-semibold">Growth grid · last 365 days</h3>
          <div className="text-[0.65rem] text-muted-foreground flex items-center gap-1.5">
            Less
            {[0.15, 0.35, 0.6, 1].map((o, i) => (
              <span
                key={i}
                className="size-2.5 rounded-sm"
                style={{
                  background: `color-mix(in oklab, var(--primary) ${o * 100}%, transparent)`,
                }}
              />
            ))}
            More
          </div>
        </div>
        <div className="overflow-x-auto -mx-2 px-2">
          <div className="min-w-[760px]">
            <div className="flex mb-1 ml-7">
              {monthLabels.map((m, i) => (
                <span
                  key={i}
                  className="text-[0.6rem] text-muted-foreground"
                  style={{ width: `${m.weeks * 12}px` }}
                >
                  {m.label}
                </span>
              ))}
            </div>
            <div className="flex gap-[3px]">
              <div className="flex flex-col gap-[3px] mr-1.5">
                {["Mon", "Wed", "Fri"].map((d) => (
                  <span
                    key={d}
                    className="text-[0.55rem] text-muted-foreground h-[10px] leading-none"
                    style={{ marginBottom: "10px" }}
                  >
                    {d}
                  </span>
                ))}
              </div>
              <YearGridBoard cells={grid} />
            </div>
          </div>
        </div>
      </section>

      <div className="rounded-2xl border border-border bg-[var(--surface)] p-5 sm:p-6 mb-6">
        <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
          <h3 className="font-display text-base font-semibold">Last 7 days</h3>
          <span className="text-xs text-muted-foreground">% of habits completed</span>
        </div>
        <div className="flex items-end gap-3 h-40">
          {week.map((d, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-2">
              <div className="text-[0.65rem] text-muted-foreground">{d.pct}%</div>
              <div className="w-full h-32 flex items-end">
                <div
                  className="w-full rounded-t-lg transition-all"
                  style={{
                    height: `${Math.max(d.pct, 4)}%`,
                    background:
                      d.pct === 100
                        ? "var(--success)"
                        : "linear-gradient(to top, var(--primary), var(--primary-soft))",
                    opacity: d.pct ? 1 : 0.3,
                  }}
                />
              </div>
              <span className="text-xs text-muted-foreground">{d.day}</span>
            </div>
          ))}
        </div>
      </div>

      <h2 className="font-display text-lg font-semibold mb-4">Per-habit grids</h2>
      <div className="grid lg:grid-cols-2 gap-4">
        {db.habits.map((h) => {
          const cells = gridLevels(db, h.id, 14);
          return (
            <div key={h.id} className="rounded-2xl border border-border bg-[var(--surface)] p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="size-9 rounded-lg grid place-items-center text-base shrink-0"
                    style={{
                      background: `color-mix(in oklab, ${habitColor(h.color)} 15%, transparent)`,
                    }}
                  >
                    {h.icon}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{h.name}</div>
                    <div className="text-[0.7rem] text-muted-foreground">
                      Current {streakFor(db, h.id)}d · Best {bestStreakFor(db, h.id)}d
                    </div>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-[repeat(14,minmax(0,1fr))] gap-[3px]">
                {cells.map((lvl, i) => (
                  <div
                    key={i}
                    className="aspect-square rounded-[3px]"
                    style={{
                      background: lvl > 0 ? habitColor(h.color) : "var(--surface-2)",
                    }}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </AppShell>
  );
}

function YearGridBoard({ cells }: { cells: ReturnType<typeof yearGrid> }) {
  // Build columns of 7 (Sun..Sat). cells are in chronological order ending today.
  // First, pad the start so the first column starts on Sunday.
  const padStart = cells.length > 0 ? new Date(cells[0].date).getDay() : 0;
  const padded: (typeof cells)[number][] = [];
  for (let i = 0; i < padStart; i++) {
    padded.push({ date: "", pct: 0, checks: 0, total: 0 });
  }
  for (const c of cells) padded.push(c);
  while (padded.length % 7 !== 0) {
    padded.push({ date: "", pct: 0, checks: 0, total: 0 });
  }
  const columns: (typeof cells)[number][][] = [];
  for (let i = 0; i < padded.length; i += 7) {
    columns.push(padded.slice(i, i + 7));
  }

  return (
    <div className="flex gap-[3px]">
      {columns.map((col, ci) => (
        <div key={ci} className="flex flex-col gap-[3px]">
          {col.map((cell, ri) => {
            const empty = !cell.date;
            const intensity = cell.pct / 100;
            return (
              <span
                key={`${ci}-${ri}`}
                title={
                  empty ? "" : `${cell.date}: ${cell.checks}/${cell.total} habits (${cell.pct}%)`
                }
                className="block rounded-[2px]"
                style={{
                  width: 9,
                  height: 9,
                  background: empty
                    ? "transparent"
                    : intensity > 0
                      ? `color-mix(in oklab, var(--primary) ${15 + intensity * 80}%, transparent)`
                      : "var(--surface-2)",
                }}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

function computeMonthLabels(cells: ReturnType<typeof yearGrid>) {
  // For each week (column), figure out which month it primarily belongs to.
  // We approximate: every ~4 weeks we add a label.
  const weeks = Math.ceil(cells.length / 7);
  const result: { label: string; weeks: number }[] = [];
  let lastMonth = -1;
  let count = 0;
  for (let w = 0; w < weeks; w++) {
    const cellIdx = Math.min(cells.length - 1, w * 7);
    const cell = cells[cellIdx];
    if (!cell?.date) continue;
    const m = new Date(cell.date).getMonth();
    if (m !== lastMonth) {
      if (count > 0) {
        result[result.length - 1].weeks = count;
      }
      const label = new Date(cell.date).toLocaleString(undefined, { month: "short" });
      result.push({ label, weeks: 1 });
      count = 1;
      lastMonth = m;
    } else {
      count++;
    }
  }
  if (count > 0 && result.length) result[result.length - 1].weeks = count;
  return result;
}

function Metric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-2xl border border-border bg-[var(--surface)] p-4">
      <div className="text-[0.65rem] uppercase tracking-[0.1em] text-muted-foreground">{label}</div>
      <div className="font-display text-3xl font-bold mt-1" style={{ color }}>
        {value}
      </div>
    </div>
  );
}
