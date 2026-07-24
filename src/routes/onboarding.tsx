import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { addHabit, updateProfile, useDb, useMounted, type Habit } from "@/lib/habits";
import { requestNotificationPermission } from "@/lib/reminders";

export const Route = createFileRoute("/onboarding")({ component: OnboardingPage });

const FOCUS_AREAS = [
  { id: "mind", label: "Mind", emoji: "🧠", desc: "Read, learn, journal" },
  { id: "body", label: "Body", emoji: "💪", desc: "Move, eat, sleep" },
  { id: "spirit", label: "Spirit", emoji: "🧘", desc: "Meditate, gratitude" },
  { id: "career", label: "Career", emoji: "🚀", desc: "Skills, deep work" },
  { id: "creativity", label: "Creativity", emoji: "🎨", desc: "Make things" },
  { id: "money", label: "Money", emoji: "💰", desc: "Save, invest, learn" },
  { id: "relationships", label: "People", emoji: "🤝", desc: "Friends, family" },
  { id: "rest", label: "Rest", emoji: "🛌", desc: "Recover, slow down" },
] as const;

type Template = {
  id: string;
  name: string;
  icon: string;
  color: Habit["color"];
  identity: string;
  reminder?: string;
};

const TEMPLATES: Template[] = [
  {
    id: "t-run",
    name: "Move 20 minutes",
    icon: "🏃",
    color: "green",
    identity: "moves every day",
    reminder: "07:00",
  },
  { id: "t-water", name: "Drink 2L water", icon: "💧", color: "teal", identity: "stays hydrated" },
  {
    id: "t-read",
    name: "Read 20 pages",
    icon: "📖",
    color: "purple",
    identity: "reads every day",
    reminder: "21:00",
  },
  {
    id: "t-meditate",
    name: "Meditate 10m",
    icon: "🧘",
    color: "amber",
    identity: "breathes mindfully",
    reminder: "07:30",
  },
  {
    id: "t-journal",
    name: "Write 3 lines",
    icon: "✍️",
    color: "coral",
    identity: "reflects daily",
    reminder: "21:30",
  },
  {
    id: "t-sleep",
    name: "Lights out by 10:30",
    icon: "🛌",
    color: "purple",
    identity: "sleeps early",
    reminder: "22:15",
  },
  {
    id: "t-strength",
    name: "Strength training",
    icon: "💪",
    color: "coral",
    identity: "trains consistently",
    reminder: "18:00",
  },
  { id: "t-greens", name: "Eat greens", icon: "🥗", color: "green", identity: "eats clean" },
  { id: "t-walk", name: "10k steps", icon: "🚶", color: "teal", identity: "walks every day" },
  {
    id: "t-noscreen",
    name: "No phone first hour",
    icon: "📵",
    color: "amber",
    identity: "owns my mornings",
    reminder: "06:30",
  },
  {
    id: "t-code",
    name: "Code 30 minutes",
    icon: "💻",
    color: "purple",
    identity: "ships every day",
    reminder: "20:00",
  },
  {
    id: "t-gratitude",
    name: "Note one good thing",
    icon: "🌱",
    color: "green",
    identity: "notices the good",
    reminder: "21:00",
  },
];

const STEPS = ["welcome", "name", "identity", "focus", "habits", "notifications", "done"] as const;
type StepKey = (typeof STEPS)[number];

function OnboardingPage() {
  const db = useDb();
  const mounted = useMounted();
  const navigate = useNavigate();

  const [step, setStep] = useState<StepKey>("welcome");
  const [direction, setDirection] = useState<1 | -1>(1);

  const [name, setName] = useState(db.profile.name);
  const [identity, setIdentity] = useState(db.profile.identity);
  const [areas, setAreas] = useState<string[]>(db.profile.focusAreas);
  const [picked, setPicked] = useState<string[]>([]);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    typeof window !== "undefined" && "Notification" in window
      ? Notification.permission
      : "unsupported",
  );

  const stepIndex = STEPS.indexOf(step);
  const total = STEPS.length;
  const progress = Math.round(((stepIndex + 1) / total) * 100);

  const goNext = () => {
    setDirection(1);
    const next = STEPS[Math.min(stepIndex + 1, total - 1)];
    setStep(next);
  };
  const goBack = () => {
    setDirection(-1);
    const prev = STEPS[Math.max(stepIndex - 1, 0)];
    setStep(prev);
  };

  const canGoNext = useMemo(() => {
    if (step === "name") return name.trim().length > 1;
    if (step === "focus") return areas.length > 0;
    return true;
  }, [step, name, areas]);

  if (!mounted) return null;

  const finish = () => {
    updateProfile({
      name: name.trim(),
      identity: identity.trim(),
      focusAreas: areas,
      onboardingCompleted: true,
    });

    for (const id of picked) {
      const t = TEMPLATES.find((x) => x.id === id);
      if (!t) continue;
      addHabit({
        name: t.name,
        icon: t.icon,
        color: t.color,
        identity: t.identity,
        reminderTime: t.reminder,
        frequency: "daily",
      });
    }

    // After onboarding, create an account so progress is backed up.
    void navigate({ to: "/account" });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-2xl flex-col px-4 py-6 sm:py-12 min-h-screen pb-[env(safe-area-inset-bottom)]">
        <Header step={stepIndex} total={total} progress={progress} />

        <main className="flex-1 mt-8">
          <div
            key={step}
            className={
              "transform transition-all duration-300 ease-out " +
              (direction === 1
                ? "animate-[slideUp_300ms_ease-out]"
                : "animate-[slideDown_300ms_ease-out]")
            }
          >
            {step === "welcome" && <WelcomeStep />}
            {step === "name" && <NameStep name={name} setName={setName} />}
            {step === "identity" && (
              <IdentityStep name={name} identity={identity} setIdentity={setIdentity} />
            )}
            {step === "focus" && <FocusStep areas={areas} setAreas={setAreas} />}
            {step === "habits" && (
              <HabitsStep picked={picked} setPicked={setPicked} areas={areas} />
            )}
            {step === "notifications" && (
              <NotificationsStep permission={permission} setPermission={setPermission} />
            )}
            {step === "done" && <DoneStep name={name} pickedCount={picked.length} />}
          </div>
        </main>

        <Footer
          stepIndex={stepIndex}
          total={total}
          canGoNext={canGoNext}
          onBack={goBack}
          onNext={step === "done" ? finish : goNext}
          nextLabel={step === "done" ? "Create my account" : "Continue"}
        />
      </div>

      {/* Inline keyframes so we don't fight Tailwind config */}
      <style>{`
        @keyframes slideUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideDown { from { opacity: 0; transform: translateY(-12px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}

function Header({ step, total, progress }: { step: number; total: number; progress: number }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-2">
          <span className="size-2 rounded-full bg-primary animate-pulse" />
          <span className="font-display font-bold tracking-wide text-foreground">Grovv</span>
        </span>
        <span>
          Step {step + 1} of {total}
        </span>
      </div>
      <div className="mt-3 h-1 rounded-full bg-[var(--surface-2)] overflow-hidden">
        <div
          className="h-full bg-primary transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

function Footer({
  stepIndex,
  total,
  canGoNext,
  onBack,
  onNext,
  nextLabel,
}: {
  stepIndex: number;
  total: number;
  canGoNext: boolean;
  onBack: () => void;
  onNext: () => void;
  nextLabel: string;
}) {
  return (
    <div className="mt-8 flex items-center gap-3">
      <button
        type="button"
        onClick={onBack}
        disabled={stepIndex === 0}
        className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold disabled:opacity-30 hover:bg-[var(--surface-2)] transition-colors shrink-0"
      >
        Back
      </button>
      <button
        type="button"
        onClick={onNext}
        disabled={!canGoNext}
        className="flex-1 sm:flex-initial rounded-full bg-primary px-5 sm:px-7 py-3 sm:py-2.5 text-sm font-semibold text-primary-foreground hover:shadow-glow disabled:opacity-50 transition-all"
      >
        {nextLabel}
      </button>
      <span className="hidden sm:block text-xs text-muted-foreground ml-auto">
        {stepIndex + 1}/{total}
      </span>
    </div>
  );
}

function WelcomeStep() {
  return (
    <section>
      <div
        className="relative mx-auto mb-6 grid size-32 place-items-center rounded-full"
        style={{
          background:
            "radial-gradient(circle at 30% 30%, color-mix(in oklab, var(--primary) 28%, transparent), transparent 70%)",
        }}
      >
        <span className="text-6xl">🌱</span>
      </div>
      <p className="text-xs uppercase tracking-[0.18em] text-primary text-center">Welcome</p>
      <h1 className="mt-2 text-center font-display text-4xl sm:text-5xl">
        Grow on <span className="text-gradient">purpose.</span>
      </h1>
      <p className="mt-3 text-center text-muted-foreground">
        Grovv is a habit, wellness, and focus space designed around who you want to become — not
        just what you want to track.
      </p>
      <div className="mt-6 grid gap-2 sm:grid-cols-2">
        {[
          ["⏱", "Focus timer", "Pomodoro, deep work, linked to habits"],
          ["🔔", "Smart reminders", "Notifications per habit, set when you create it"],
          ["📊", "Insights", "Streaks, patterns, weekly review"],
          ["🌱", "Identity-first", "Tied to who you want to become"],
        ].map(([emoji, title, desc]) => (
          <div
            key={title}
            className="rounded-2xl border border-border bg-[var(--surface)] p-4 flex gap-3"
          >
            <span className="text-2xl leading-none">{emoji}</span>
            <div>
              <p className="font-display text-sm font-semibold">{title}</p>
              <p className="text-xs text-muted-foreground">{desc}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function NameStep({ name, setName }: { name: string; setName: (v: string) => void }) {
  return (
    <section>
      <p className="text-xs uppercase tracking-[0.18em] text-primary">Hello</p>
      <h2 className="mt-2 font-display text-3xl sm:text-4xl">What should we call you?</h2>
      <p className="mt-2 text-muted-foreground">
        We'll personalize your dashboard greeting. Just a first name works.
      </p>
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Your name"
        className="mt-6 w-full rounded-2xl border border-border bg-[var(--surface)] px-5 py-4 text-lg focus:outline-none focus:border-primary/60"
      />
      {name.trim().length > 1 && (
        <p className="mt-3 text-sm text-muted-foreground">
          We'll greet you with{" "}
          <strong className="text-foreground">Good morning, {name.trim()} 👋</strong>
        </p>
      )}
    </section>
  );
}

function IdentityStep({
  name,
  identity,
  setIdentity,
}: {
  name: string;
  identity: string;
  setIdentity: (v: string) => void;
}) {
  const suggestions = [
    "shows up consistently",
    "puts health first",
    "reads every day",
    "ships work daily",
    "moves their body",
    "rests with intention",
  ];
  return (
    <section>
      <p className="text-xs uppercase tracking-[0.18em] text-primary">Identity</p>
      <h2 className="mt-2 font-display text-3xl sm:text-4xl">
        {name ? `${name}, who are you becoming?` : "Who are you becoming?"}
      </h2>
      <p className="mt-2 text-muted-foreground">
        Habits stick when they're tied to identity. Finish the sentence:
      </p>
      <div className="mt-6 rounded-2xl border border-border bg-[var(--surface)] p-5">
        <p className="text-sm text-muted-foreground italic">I am someone who…</p>
        <input
          value={identity}
          onChange={(e) => setIdentity(e.target.value)}
          placeholder="moves every morning"
          className="mt-2 w-full rounded-xl border border-border bg-[var(--surface-2)] px-4 py-3 text-base focus:outline-none focus:border-primary/60"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setIdentity(s)}
              className="rounded-full border border-border bg-[var(--surface-2)] px-3 py-1 text-xs"
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function FocusStep({ areas, setAreas }: { areas: string[]; setAreas: (v: string[]) => void }) {
  const toggle = (id: string) =>
    setAreas(areas.includes(id) ? areas.filter((a) => a !== id) : [...areas, id]);
  return (
    <section>
      <p className="text-xs uppercase tracking-[0.18em] text-primary">Focus areas</p>
      <h2 className="mt-2 font-display text-3xl sm:text-4xl">Where do you want to grow?</h2>
      <p className="mt-2 text-muted-foreground">Pick at least one. You can change this later.</p>
      <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-2">
        {FOCUS_AREAS.map((a) => {
          const active = areas.includes(a.id);
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => toggle(a.id)}
              aria-pressed={active}
              className={
                "rounded-2xl border p-4 text-left transition-all " +
                (active
                  ? "border-primary/60 bg-primary/10 scale-[1.02]"
                  : "border-border bg-[var(--surface)] hover:bg-[var(--surface-2)]")
              }
            >
              <span className="text-2xl">{a.emoji}</span>
              <p className="mt-2 font-display text-sm font-semibold">{a.label}</p>
              <p className="text-[0.7rem] text-muted-foreground">{a.desc}</p>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function HabitsStep({
  picked,
  setPicked,
  areas,
}: {
  picked: string[];
  setPicked: (v: string[]) => void;
  areas: string[];
}) {
  const toggle = (id: string) =>
    setPicked(picked.includes(id) ? picked.filter((p) => p !== id) : [...picked, id]);

  // Lightly suggest order based on focus areas; show all though.
  const ordered = useMemo(() => {
    const score = (t: Template) => {
      const text = `${t.name} ${t.identity}`.toLowerCase();
      let s = 0;
      if (areas.includes("body") && /run|move|train|step|sleep|gym|water/.test(text)) s += 2;
      if (areas.includes("mind") && /read|journal|note|gratitude|phone/.test(text)) s += 2;
      if (areas.includes("spirit") && /meditate|breath|gratitude/.test(text)) s += 2;
      if (areas.includes("career") && /code|ship|work/.test(text)) s += 2;
      if (areas.includes("rest") && /sleep|rest|phone/.test(text)) s += 2;
      return s;
    };
    return [...TEMPLATES].sort((a, b) => score(b) - score(a));
  }, [areas]);

  return (
    <section>
      <p className="text-xs uppercase tracking-[0.18em] text-primary">First habits</p>
      <h2 className="mt-2 font-display text-3xl sm:text-4xl">Pick 1–3 to start.</h2>
      <p className="mt-2 text-muted-foreground">Less is more on day one. You can add more later.</p>
      <div className="mt-6 grid gap-2 sm:grid-cols-2">
        {ordered.map((t) => {
          const active = picked.includes(t.id);
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => toggle(t.id)}
              aria-pressed={active}
              className={
                "rounded-2xl border p-4 flex items-center gap-3 text-left transition-all " +
                (active
                  ? "border-primary/60 bg-primary/10"
                  : "border-border bg-[var(--surface)] hover:bg-[var(--surface-2)]")
              }
            >
              <span className="text-2xl">{t.icon}</span>
              <div className="flex-1">
                <p className="font-display text-sm font-semibold">{t.name}</p>
                <p className="text-[0.7rem] text-muted-foreground italic">“{t.identity}”</p>
              </div>
              {t.reminder && (
                <span className="rounded-full border border-border bg-[var(--surface-2)] px-2 py-0.5 text-[0.65rem]">
                  🔔 {t.reminder}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function NotificationsStep({
  permission,
  setPermission,
}: {
  permission: NotificationPermission | "unsupported";
  setPermission: (p: NotificationPermission | "unsupported") => void;
}) {
  return (
    <section>
      <p className="text-xs uppercase tracking-[0.18em] text-primary">Notifications</p>
      <h2 className="mt-2 font-display text-3xl sm:text-4xl">Get gentle nudges.</h2>
      <p className="mt-2 text-muted-foreground">
        Reminders use your browser's notifications. We send one per habit at the time you set — only
        if it's not already done that day.
      </p>
      <div className="mt-6 rounded-2xl border border-border bg-[var(--surface)] p-5">
        <p className="text-sm">
          Permission status: <strong>{String(permission)}</strong>
        </p>
        <button
          type="button"
          onClick={async () => {
            const next = await requestNotificationPermission();
            if (next !== "unsupported") {
              setPermission(next);
              updateProfile({ remindersEnabled: next === "granted" });
            }
          }}
          className="mt-3 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
        >
          Enable notifications
        </button>
        <p className="mt-2 text-xs text-muted-foreground">
          You can manage this anytime in <strong>Reminders</strong> or <strong>Settings</strong>.
        </p>
      </div>
    </section>
  );
}

function DoneStep({ name, pickedCount }: { name: string; pickedCount: number }) {
  return (
    <section>
      <p className="text-xs uppercase tracking-[0.18em] text-primary">All set</p>
      <h2 className="mt-2 font-display text-3xl sm:text-4xl">Let's grow, {name || "friend"}.</h2>
      <p className="mt-2 text-muted-foreground">
        {pickedCount > 0
          ? `${pickedCount} habit${pickedCount === 1 ? "" : "s"} added. Tap any one in your dashboard to mark today done.`
          : "You'll start with no habits — add your first one from the Habits screen."}
      </p>
      <ul className="mt-6 space-y-2 text-sm">
        <li className="rounded-xl border border-border bg-[var(--surface)] p-3">
          ✦ Use <strong>Home</strong> to check off today's habits.
        </li>
        <li className="rounded-xl border border-border bg-[var(--surface)] p-3">
          ⏱ Use the <strong>Focus timer</strong> for Pomodoro sessions linked to your habits.
        </li>
        <li className="rounded-xl border border-border bg-[var(--surface)] p-3">
          ◐ Next: <strong>create your account</strong> so your progress is saved and synced.
        </li>
        <li className="rounded-xl border border-border bg-[var(--surface)] p-3">
          📊 Open <strong>Analytics</strong> after a few days to see patterns emerge.
        </li>
      </ul>
    </section>
  );
}
