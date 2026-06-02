import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell, PageHeader } from "@/components/app-shell";
import {
  useDb,
  useMounted,
  addHabit,
  deleteHabit,
  updateHabit,
  streakFor,
  bestStreakFor,
  habitColor,
  recoverableFreezeDate,
  useFreeze as applyFreeze,
  type Habit,
  type HabitDb,
  type HabitFrequency,
} from "@/lib/habits";

export const Route = createFileRoute("/habits")({ component: HabitsPage });

const COLORS: Habit["color"][] = ["purple", "green", "amber", "teal", "coral", "pink"];
const ICONS = [
  "🏃",
  "💧",
  "📖",
  "🧘",
  "🥗",
  "💪",
  "🛌",
  "🧠",
  "✍️",
  "🎯",
  "🚶",
  "☕",
  "🌱",
  "📵",
  "🧴",
  "💻",
  "🚿",
  "🎨",
];

const FREQ_LABEL: Record<HabitFrequency, string> = {
  daily: "Every day",
  weekdays: "Weekdays",
  weekends: "Weekends",
};

function HabitsPage() {
  const db = useDb();
  const mounted = useMounted();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Habit | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Habit | null>(null);

  if (!mounted) return <AppShell>{null}</AppShell>;

  const habitMap = new Map(db.habits.map((h) => [h.id, h] as const));

  return (
    <AppShell>
      <PageHeader
        eyebrow="Manage"
        title={
          <>
            Your <span className="text-gradient">habits</span>
          </>
        }
        subtitle="Each habit can have its own reminder, frequency, identity, stack-after, and timer preset."
        actions={
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
            className="bg-primary text-primary-foreground px-4 sm:px-5 py-2.5 rounded-full text-sm font-medium hover:shadow-glow transition-all whitespace-nowrap"
          >
            + New habit
          </button>
        }
      />

      {db.habits.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-[var(--surface)] p-12 text-center">
          <div className="text-4xl mb-3">🌱</div>
          <h3 className="font-display text-lg font-semibold">Plant your first habit</h3>
          <p className="text-sm text-muted-foreground mt-1">Start small — one habit, every day.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {db.habits.map((h) => {
            const stack = h.stackAfterId ? habitMap.get(h.stackAfterId) : undefined;
            return (
              <div
                key={h.id}
                className="rounded-2xl border border-border bg-[var(--surface)] p-5 group relative overflow-hidden"
              >
                <div
                  className="absolute -top-12 -right-12 size-32 rounded-full opacity-20 blur-2xl"
                  style={{ background: habitColor(h.color) }}
                />
                <div className="relative">
                  <div className="flex items-start justify-between mb-3">
                    <div
                      className="size-12 rounded-xl grid place-items-center text-xl"
                      style={{
                        background: `color-mix(in oklab, ${habitColor(h.color)} 15%, transparent)`,
                      }}
                    >
                      {h.icon}
                    </div>
                    <div className="flex gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                      <IconBtn
                        label="Edit"
                        onClick={() => {
                          setEditing(h);
                          setOpen(true);
                        }}
                      >
                        ✎
                      </IconBtn>
                      <IconBtn label="Delete" danger onClick={() => setPendingDelete(h)}>
                        ×
                      </IconBtn>
                    </div>
                  </div>
                  <div className="font-display text-base font-semibold">{h.name}</div>
                  {h.identity && (
                    <p className="text-[0.7rem] text-muted-foreground mt-1 italic">
                      “{h.identity}”
                    </p>
                  )}
                  {stack && (
                    <p className="mt-1 text-[0.7rem] text-muted-foreground">
                      ⛓ After {stack.icon} <span className="font-medium">{stack.name}</span>
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-1.5 text-[0.65rem]">
                    <Tag>{FREQ_LABEL[h.frequency]}</Tag>
                    {h.reminderTime ? <Tag>🔔 {h.reminderTime}</Tag> : <Tag muted>No reminder</Tag>}
                    {h.defaultTimerMin && <Tag>⏱ {h.defaultTimerMin}m</Tag>}
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-4">
                    <Stat label="Current" value={`${streakFor(db, h.id)}d`} />
                    <Stat label="Best" value={`${bestStreakFor(db, h.id)}d`} />
                  </div>
                  <FreezeAction db={db} habitId={h.id} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {open && (
        <HabitDialog
          initial={editing}
          allHabits={db.habits}
          onClose={() => setOpen(false)}
          onSave={(data) => {
            if (editing) updateHabit(editing.id, data);
            else addHabit(data);
            setOpen(false);
          }}
        />
      )}
      {pendingDelete && (
        <ConfirmDialog
          title={`Delete "${pendingDelete.name}"?`}
          description="This removes the habit and all of its check-in history."
          confirmLabel="Delete habit"
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            deleteHabit(pendingDelete.id);
            setPendingDelete(null);
          }}
        />
      )}
    </AppShell>
  );
}

function relativeDayLabel(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((startOfToday.getTime() - date.getTime()) / 86400000);
  if (diff === 1) return "yesterday";
  if (diff <= 6) return date.toLocaleDateString(undefined, { weekday: "long" });
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function FreezeAction({ db, habitId }: { db: HabitDb; habitId: string }) {
  if (db.profile.vacationActive) {
    return (
      <p className="mt-3 flex items-center gap-1 text-[0.7rem] text-muted-foreground">
        <span aria-hidden>🏝</span> Vacation mode is keeping this streak safe.
      </p>
    );
  }

  const gapKey = recoverableFreezeDate(db, habitId);
  if (!gapKey) return null;

  const label = relativeDayLabel(gapKey);
  const balance = db.profile.freezeBalance;

  if (balance <= 0) {
    return (
      <p className="mt-3 text-[0.7rem] text-muted-foreground">
        Missed {label} · no streak freezes left this month.
      </p>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        const [y, m, d] = gapKey.split("-").map(Number);
        applyFreeze(habitId, new Date(y, m - 1, d));
      }}
      className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-primary/40 bg-primary/10 px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-primary/20"
    >
      <span aria-hidden>🧊</span> Save streak — freeze {label}
      <span className="text-muted-foreground">· {balance} left</span>
    </button>
  );
}

function Tag({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <span
      className={
        "rounded-full border px-2 py-0.5 " +
        (muted
          ? "border-border bg-[var(--surface-2)] text-muted-foreground"
          : "border-primary/30 bg-primary/10 text-foreground")
      }
    >
      {children}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-[var(--surface-2)] px-3 py-2">
      <div className="text-[0.6rem] uppercase tracking-[0.1em] text-muted-foreground">{label}</div>
      <div className="font-display font-bold text-sm mt-0.5">{value}</div>
    </div>
  );
}

function IconBtn({
  children,
  onClick,
  danger,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={
        "size-7 rounded-lg grid place-items-center text-sm transition-colors " +
        (danger
          ? "bg-[var(--surface-2)] hover:bg-[color:var(--destructive)]/20 hover:text-[color:var(--destructive)]"
          : "bg-[var(--surface-2)] hover:bg-[color:var(--primary)]/20")
      }
    >
      {children}
    </button>
  );
}

type HabitFormData = {
  name: string;
  icon: string;
  color: Habit["color"];
  reminderTime?: string;
  identity?: string;
  frequency: HabitFrequency;
  stackAfterId?: string;
  defaultTimerMin?: number;
};

function HabitDialog({
  initial,
  allHabits,
  onClose,
  onSave,
}: {
  initial: Habit | null;
  allHabits: Habit[];
  onClose: () => void;
  onSave: (data: HabitFormData) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [icon, setIcon] = useState(initial?.icon ?? "🎯");
  const [color, setColor] = useState<Habit["color"]>(initial?.color ?? "purple");
  const [identity, setIdentity] = useState(initial?.identity ?? "");
  const [frequency, setFrequency] = useState<HabitFrequency>(initial?.frequency ?? "daily");
  const [reminderEnabled, setReminderEnabled] = useState(Boolean(initial?.reminderTime));
  const [reminderTime, setReminderTime] = useState(initial?.reminderTime ?? "08:00");
  const [stackAfterId, setStackAfterId] = useState(initial?.stackAfterId ?? "");
  const [timerEnabled, setTimerEnabled] = useState(Boolean(initial?.defaultTimerMin));
  const [timerMin, setTimerMin] = useState(initial?.defaultTimerMin ?? 25);

  const stackCandidates = allHabits.filter((h) => h.id !== initial?.id);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-background/70 backdrop-blur-sm p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="habit-dialog-title"
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl border border-border bg-[var(--surface)] p-6 sm:p-7"
      >
        <h3 id="habit-dialog-title" className="font-display text-2xl font-bold">
          {initial ? "Edit habit" : "New habit"}
        </h3>
        <p className="text-xs text-muted-foreground mt-1 mb-5">
          Make it small. Make it specific. Tie it to who you want to become.
        </p>

        <div className="space-y-5">
          <Field label="Habit">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Morning run"
              className="w-full bg-[var(--surface-2)] border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary/60"
            />
          </Field>

          <Field label="Identity statement" hint="Who does this habit make you become?">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground italic">I am someone who…</span>
              <input
                value={identity}
                onChange={(e) => setIdentity(e.target.value)}
                placeholder="runs every morning"
                className="flex-1 bg-[var(--surface-2)] border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/60"
              />
            </div>
          </Field>

          <Field label="Icon">
            <div className="grid grid-cols-9 gap-1.5">
              {ICONS.map((i) => (
                <button
                  type="button"
                  key={i}
                  onClick={() => setIcon(i)}
                  aria-pressed={icon === i}
                  className={
                    "aspect-square rounded-lg grid place-items-center text-lg transition-all " +
                    (icon === i
                      ? "bg-primary/20 ring-1 ring-primary/60"
                      : "bg-[var(--surface-2)] hover:bg-[var(--surface-2)]/60")
                  }
                >
                  {i}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Color">
            <div className="flex gap-2">
              {COLORS.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setColor(c)}
                  aria-label={c}
                  aria-pressed={color === c}
                  className={
                    "size-9 rounded-full transition-all " +
                    (color === c
                      ? "ring-2 ring-offset-2 ring-offset-[var(--surface)] ring-foreground/40 scale-110"
                      : "")
                  }
                  style={{ background: habitColor(c) }}
                />
              ))}
            </div>
          </Field>

          <Field label="Frequency">
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(FREQ_LABEL) as HabitFrequency[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFrequency(f)}
                  aria-pressed={frequency === f}
                  className={
                    "rounded-lg border px-3 py-2 text-sm transition-colors " +
                    (frequency === f
                      ? "bg-primary/15 border-primary/60"
                      : "bg-[var(--surface-2)] border-border")
                  }
                >
                  {FREQ_LABEL[f]}
                </button>
              ))}
            </div>
          </Field>

          {stackCandidates.length > 0 && (
            <Field
              label="Habit stacking"
              hint='Anchor this to an existing habit: "After I X, I do this."'
            >
              <select
                value={stackAfterId}
                onChange={(e) => setStackAfterId(e.target.value)}
                className="w-full bg-[var(--surface-2)] border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/60"
              >
                <option value="">No anchor</option>
                {stackCandidates.map((h) => (
                  <option key={h.id} value={h.id}>
                    After {h.icon} {h.name}
                  </option>
                ))}
              </select>
            </Field>
          )}

          <Field
            label="Reminder"
            hint="Get a notification at this time. Permission is requested in Settings."
          >
            <div className="flex items-center gap-3">
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={reminderEnabled}
                  onChange={(e) => setReminderEnabled(e.target.checked)}
                />
                <span>Enable</span>
              </label>
              <input
                type="time"
                disabled={!reminderEnabled}
                value={reminderTime}
                onChange={(e) => setReminderTime(e.target.value)}
                className="bg-[var(--surface-2)] border border-border rounded-lg px-3 py-2 text-sm disabled:opacity-50"
              />
            </div>
          </Field>

          <Field
            label="Timer preset"
            hint="Sets a default duration when this habit is opened in the Timer."
          >
            <div className="flex items-center gap-3 flex-wrap">
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={timerEnabled}
                  onChange={(e) => setTimerEnabled(e.target.checked)}
                />
                <span>Enable</span>
              </label>
              <input
                type="number"
                min={1}
                max={240}
                step={5}
                disabled={!timerEnabled}
                value={timerMin}
                onChange={(e) => setTimerMin(parseInt(e.target.value || "25", 10))}
                className="w-24 bg-[var(--surface-2)] border border-border rounded-lg px-3 py-2 text-sm disabled:opacity-50"
              />
              <span className="text-xs text-muted-foreground">minutes</span>
            </div>
          </Field>
        </div>

        <div className="flex gap-2 mt-7">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-full text-sm border border-border hover:bg-[var(--surface-2)] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!name.trim()}
            onClick={() =>
              onSave({
                name: name.trim(),
                icon,
                color,
                identity: identity.trim() || undefined,
                frequency,
                reminderTime: reminderEnabled ? reminderTime : undefined,
                stackAfterId: stackAfterId || undefined,
                defaultTimerMin: timerEnabled ? Math.max(1, Math.min(240, timerMin)) : undefined,
              })
            }
            className="flex-1 px-4 py-2.5 rounded-full text-sm bg-primary text-primary-foreground font-medium disabled:opacity-50 hover:shadow-glow transition-all"
          >
            {initial ? "Save changes" : "Create habit"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5 gap-3">
        <span className="text-[0.65rem] uppercase tracking-[0.1em] text-muted-foreground">
          {label}
        </span>
        {hint && <span className="text-[0.65rem] text-muted-foreground text-right">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function ConfirmDialog({
  title,
  description,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-background/70 backdrop-blur-sm p-4"
      onClick={onCancel}
      role="presentation"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-confirm-title"
        className="w-full max-w-md rounded-2xl border border-border bg-[var(--surface)] p-6"
      >
        <h3 id="delete-confirm-title" className="font-display text-xl font-bold">
          {title}
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 rounded-full text-sm border border-border hover:bg-[var(--surface-2)] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 px-4 py-2.5 rounded-full text-sm border border-[color:var(--destructive)]/40 text-[color:var(--destructive)] hover:bg-[color:var(--destructive)]/10 transition-colors"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
