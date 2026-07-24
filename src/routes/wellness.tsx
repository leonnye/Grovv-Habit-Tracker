import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell, PageHeader } from "@/components/app-shell";
import {
  addDays,
  deleteJournalEntry,
  logWellness,
  moodHabitCorrelations,
  setJournalEntry,
  useDb,
  useMounted,
  ymd,
  type JournalEntry,
} from "@/lib/habits";

export const Route = createFileRoute("/wellness")({ component: WellnessPage });

const MOOD_EMOJI = ["", "😞", "😕", "😐", "🙂", "😄"];
const TABS = [
  { id: "today", label: "Today" },
  { id: "history", label: "History" },
  { id: "journal", label: "Journal" },
  { id: "insights", label: "Insights" },
] as const;
type TabKey = (typeof TABS)[number]["id"];

function WellnessPage() {
  const db = useDb();
  const mounted = useMounted();
  const [tab, setTab] = useState<TabKey>("today");
  if (!mounted) return <AppShell>{null}</AppShell>;

  return (
    <AppShell>
      <PageHeader
        eyebrow="Wellness"
        title={
          <>
            Your daily <span className="text-gradient">wellbeing</span>
          </>
        }
        subtitle="Mood, sleep, hydration, and a private journal — designed to help you spot patterns."
      />

      <>
        <div className="mb-6 flex flex-wrap gap-2">
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                aria-pressed={active}
                className={
                  "rounded-full border px-4 py-2 text-sm font-medium transition-colors " +
                  (active
                    ? "border-primary/60 bg-primary/15 text-foreground"
                    : "border-border bg-[var(--surface)] text-muted-foreground hover:text-foreground")
                }
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {tab === "today" && <TodayTab />}
        {tab === "history" && <HistoryTab />}
        {tab === "journal" && <JournalTab />}
        {tab === "insights" && <InsightsTab />}
      </>
    </AppShell>
  );
}

function TodayTab() {
  const db = useDb();
  const today = new Date();
  const todays = db.wellness[ymd(today)] ?? { date: ymd(today) };
  const [note, setNote] = useState(todays.note ?? "");

  useEffect(() => {
    setNote(todays.note ?? "");
    // Re-init when day flips
  }, [todays.note]);

  const last14 = Array.from({ length: 14 }, (_, i) => {
    const d = addDays(today, -(13 - i));
    return db.wellness[ymd(d)] ?? { date: ymd(d) };
  });

  const avg = (key: "sleepHours" | "waterLiters" | "mood") => {
    const vals = last14.map((w) => w[key]).filter((v): v is number => typeof v === "number");
    if (!vals.length) return 0;
    return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
  };

  return (
    <div className="grovv-fade-up">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <SummaryCard
          label="Avg sleep"
          value={avg("sleepHours") || "—"}
          unit="h"
          color="var(--primary)"
        />
        <SummaryCard label="Avg mood" value={avg("mood") || "—"} unit="/5" color="var(--warning)" />
        <SummaryCard
          label="Avg water"
          value={avg("waterLiters") || "—"}
          unit="L"
          color="var(--info)"
        />
      </div>

      <div className="rounded-2xl border border-border bg-[var(--surface)] p-5 sm:p-6 mb-6">
        <h3 className="font-display text-base font-semibold mb-1">Today's check-in</h3>
        <p className="text-xs text-muted-foreground mb-5">Updates save automatically.</p>

        <div className="mb-6">
          <div className="text-[0.65rem] uppercase tracking-[0.1em] text-muted-foreground mb-2">
            Mood
          </div>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((m) => {
              const active = todays.mood === m;
              return (
                <button
                  type="button"
                  key={m}
                  aria-pressed={active}
                  onClick={() => logWellness(today, { mood: m as 1 | 2 | 3 | 4 | 5 })}
                  className={
                    "flex-1 aspect-square rounded-xl text-3xl grid place-items-center transition-all border " +
                    (active
                      ? "bg-[color:var(--warning)]/15 border-[color:var(--warning)]/50"
                      : "bg-[var(--surface-2)] border-border hover:border-[color:var(--primary)]/40")
                  }
                >
                  {MOOD_EMOJI[m]}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mb-6">
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-[0.65rem] uppercase tracking-[0.1em] text-muted-foreground">
              How was today?
            </span>
            <span className="text-[0.65rem] text-muted-foreground">{note.length}/500</span>
          </div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 500))}
            onBlur={() => logWellness(today, { note: note.trim() || undefined })}
            placeholder="A line about today — wins, blockers, what you noticed."
            rows={3}
            className="w-full bg-[var(--surface-2)] border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary/60 resize-none"
          />
          <p className="mt-1 text-[0.65rem] text-muted-foreground">
            Saved automatically when you click outside the box.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <Slider
            label="Sleep"
            unit="h"
            value={todays.sleepHours ?? 0}
            max={12}
            step={0.5}
            color="var(--primary)"
            onChange={(v) => logWellness(today, { sleepHours: v })}
          />
          <Slider
            label="Water"
            unit="L"
            value={todays.waterLiters ?? 0}
            max={4}
            step={0.25}
            color="var(--info)"
            onChange={(v) => logWellness(today, { waterLiters: v })}
          />
        </div>
      </div>
    </div>
  );
}

function HistoryTab() {
  const db = useDb();
  const today = new Date();
  const last14 = Array.from({ length: 14 }, (_, i) => {
    const d = addDays(today, -(13 - i));
    return db.wellness[ymd(d)] ?? { date: ymd(d) };
  });

  return (
    <div className="rounded-2xl border border-border bg-[var(--surface)] p-5 sm:p-6 grovv-fade-up">
      <h3 className="font-display text-base font-semibold mb-4">Last 14 days</h3>
      <div className="overflow-x-auto -mx-1 px-1">
        <div
          className="min-w-[560px] grid gap-1.5"
          style={{ gridTemplateColumns: "repeat(14, minmax(0,1fr))" }}
        >
          {last14.map((w, i) => {
            const d = new Date(w.date);
            return (
              <div
                key={i}
                title={`${w.date}${w.note ? "\n" + w.note : ""}`}
                className="rounded-lg bg-[var(--surface-2)] p-2 text-center flex flex-col gap-1.5"
              >
                <div className="text-[0.6rem] text-muted-foreground">
                  {d.toLocaleDateString(undefined, { weekday: "narrow" })}
                </div>
                <div className="text-lg leading-none">{w.mood ? MOOD_EMOJI[w.mood] : "·"}</div>
                <div className="text-[0.6rem] text-muted-foreground">
                  {w.sleepHours ? `${w.sleepHours}h` : "—"}
                </div>
                {w.note && <div className="size-1 rounded-full bg-primary mx-auto" />}
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-6">
        <h4 className="font-display text-sm font-semibold mb-2">Notes from this fortnight</h4>
        <ul className="space-y-2">
          {last14
            .filter((w) => w.note)
            .reverse()
            .map((w) => (
              <li
                key={w.date}
                className="rounded-xl border border-border bg-[var(--surface-2)] px-3 py-2"
              >
                <div className="text-[0.65rem] text-muted-foreground uppercase tracking-[0.1em]">
                  {new Date(w.date).toLocaleDateString(undefined, {
                    weekday: "long",
                    month: "short",
                    day: "numeric",
                  })}
                  {w.mood && <span className="ml-2">{MOOD_EMOJI[w.mood]}</span>}
                </div>
                <p className="text-sm mt-1 whitespace-pre-wrap">{w.note}</p>
              </li>
            ))}
          {last14.filter((w) => w.note).length === 0 && (
            <li className="text-sm text-muted-foreground">
              No notes yet. Add one in Today and it'll show up here.
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}

function JournalTab() {
  const db = useDb();
  const today = new Date();
  const todayKey = ymd(today);
  const todaysEntry = db.journal[todayKey];
  const [text, setText] = useState(todaysEntry?.text ?? "");
  const [tagsRaw, setTagsRaw] = useState(todaysEntry?.tags.join(", ") ?? "");

  useEffect(() => {
    setText(todaysEntry?.text ?? "");
    setTagsRaw(todaysEntry?.tags.join(", ") ?? "");
  }, [todayKey, todaysEntry]);

  const save = () => {
    const tags = tagsRaw
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    setJournalEntry(today, text, tags);
  };

  const past = Object.values(db.journal)
    .filter((j) => j.date !== todayKey)
    .sort((a, b) => (a.date > b.date ? -1 : 1));

  return (
    <div className="space-y-4 grovv-fade-up">
      <section className="rounded-2xl border border-border bg-[var(--surface)] p-5 sm:p-6">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <h3 className="font-display text-base font-semibold">
            {today.toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </h3>
          <span className="text-[0.65rem] text-muted-foreground uppercase tracking-[0.1em]">
            Private · Local-only
          </span>
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 5000))}
          onBlur={save}
          placeholder="What's on your mind today? Wins, doubts, dreams — write freely."
          rows={8}
          className="w-full bg-[var(--surface-2)] border border-border rounded-xl px-4 py-3 text-sm leading-relaxed focus:outline-none focus:border-primary/60 resize-y"
        />
        <div className="mt-3 grid sm:grid-cols-[1fr_auto] gap-2 items-center">
          <input
            value={tagsRaw}
            onChange={(e) => setTagsRaw(e.target.value)}
            onBlur={save}
            placeholder="Tags, comma separated (e.g. work, family, gratitude)"
            className="w-full bg-[var(--surface-2)] border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/60"
          />
          <div className="flex justify-between sm:justify-end items-center gap-3">
            <span className="text-[0.65rem] text-muted-foreground">{text.length}/5000</span>
            <button
              type="button"
              onClick={save}
              className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
            >
              Save
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-[var(--surface)] p-5 sm:p-6">
        <h3 className="font-display text-base font-semibold mb-3">Past entries</h3>
        {past.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Your journal is private. Once you start writing, past entries appear here.
          </p>
        ) : (
          <ul className="space-y-3">
            {past.map((entry) => (
              <PastEntry key={entry.date} entry={entry} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function PastEntry({ entry }: { entry: JournalEntry }) {
  const [open, setOpen] = useState(false);
  const date = new Date(entry.date).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  return (
    <li className="rounded-xl border border-border bg-[var(--surface-2)] p-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-3 text-left"
      >
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-medium">{date}</span>
          {!open && (
            <span className="text-xs text-muted-foreground line-clamp-1">{entry.text}</span>
          )}
        </div>
        <span className="text-xs text-muted-foreground">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="mt-3 grovv-slide-down">
          <p className="text-sm whitespace-pre-wrap leading-relaxed">{entry.text}</p>
          {entry.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {entry.tags.map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[0.65rem]"
                >
                  #{t}
                </span>
              ))}
            </div>
          )}
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={() => deleteJournalEntry(new Date(entry.date))}
              className="text-[0.7rem] text-[color:var(--destructive)] hover:underline"
            >
              Delete entry
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

function InsightsTab() {
  const db = useDb();
  const correlations = useMemo(() => moodHabitCorrelations(db), [db]);

  return (
    <div className="space-y-4 grovv-fade-up">
      <section className="rounded-2xl border border-border bg-[var(--surface)] p-5 sm:p-6">
        <h3 className="font-display text-base font-semibold">Mood ↔ habit correlation</h3>
        <p className="text-xs text-muted-foreground mt-1 mb-4">
          We compare your average mood on days you completed a habit vs. days you didn't. Needs at
          least 5 mood logs.
        </p>
        {correlations.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Log mood for a few more days to unlock this insight.
          </p>
        ) : (
          <ul className="space-y-2">
            {correlations.map((c) => (
              <li
                key={c.habit.id}
                className="rounded-xl border border-border bg-[var(--surface-2)] p-3"
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xl">{c.habit.icon}</span>
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{c.habit.name}</div>
                      <div className="text-[0.7rem] text-muted-foreground">
                        With: {c.moodWith.toFixed(1)}/5 · Without: {c.moodWithout.toFixed(1)}/5
                      </div>
                    </div>
                  </div>
                  <div
                    className={
                      "rounded-full px-3 py-1 text-xs font-bold " +
                      (c.delta > 0
                        ? "bg-[color:var(--success)]/15 text-[color:var(--success)]"
                        : "bg-[color:var(--destructive)]/15 text-[color:var(--destructive)]")
                    }
                  >
                    {c.delta > 0 ? "+" : ""}
                    {c.delta}%
                  </div>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {c.delta > 10
                    ? `Your mood is ${c.delta}% higher on days you do "${c.habit.name}".`
                    : c.delta < -10
                      ? `Your mood is ${Math.abs(c.delta)}% lower on days you do "${c.habit.name}". Worth investigating.`
                      : `Mood looks similar with or without "${c.habit.name}".`}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  unit,
  color,
}: {
  label: string;
  value: number | string;
  unit: string;
  color: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-[var(--surface)] p-5">
      <div className="text-[0.65rem] uppercase tracking-[0.1em] text-muted-foreground">{label}</div>
      <div className="mt-1">
        <span className="font-display text-3xl font-bold" style={{ color }}>
          {value}
        </span>
        <span className="text-sm text-muted-foreground ml-1">{unit}</span>
      </div>
      <div className="text-[0.7rem] text-muted-foreground mt-1">Last 14 days</div>
    </div>
  );
}

function Slider({
  label,
  unit,
  value,
  max,
  step,
  color,
  onChange,
}: {
  label: string;
  unit: string;
  value: number;
  max: number;
  step: number;
  color: string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-[0.65rem] uppercase tracking-[0.1em] text-muted-foreground">
          {label}
        </span>
        <span className="font-display font-semibold text-lg" style={{ color }}>
          {value}
          <span className="text-xs text-muted-foreground ml-1">{unit}</span>
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-[color:var(--primary)]"
        style={{ accentColor: color }}
      />
    </div>
  );
}
