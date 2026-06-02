import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell, PageHeader } from "@/components/app-shell";
import {
  isPremium,
  startFreeTrial,
  trialDaysLeft,
  updateProfile,
  useDb,
  useMounted,
} from "@/lib/habits";

export const Route = createFileRoute("/pricing")({ component: PricingPage });

const PRO_FEATURES = [
  "Unlimited habits",
  "Wellness tracking & journal",
  "Mood ↔ habit insights",
  "Focus timer (Pomodoro / deep work)",
  "Adaptive smart reminders",
  "CSV + JSON export",
  "Future Pro updates",
] as const;

type PlanId = "pro_monthly" | "pro_annual" | "pro_lifetime";

type PlanOption = {
  id: PlanId;
  title: string;
  price: string;
  unit: string;
  sub: string;
  badge?: string;
  highlight?: boolean;
  total?: string;
};

const PLANS: PlanOption[] = [
  {
    id: "pro_monthly",
    title: "Monthly",
    price: "$1.97",
    unit: "/ month",
    sub: "Cancel anytime",
  },
  {
    id: "pro_annual",
    title: "Yearly",
    price: "$19",
    unit: "/ year",
    sub: "Just $1.58 / mo · 20% off",
    badge: "Best value",
    highlight: true,
    total: "Billed once a year",
  },
  {
    id: "pro_lifetime",
    title: "Lifetime",
    price: "$49",
    unit: "one-time",
    sub: "Pay once, own forever",
    badge: "Forever Pro",
    total: "No subscription",
  },
];

function PricingPage() {
  const db = useDb();
  const mounted = useMounted();
  const navigate = useNavigate();
  const [pendingPlan, setPendingPlan] = useState<PlanId | null>(null);
  const [email, setEmail] = useState(db.profile.email ?? "");

  if (!mounted) return <AppShell>{null}</AppShell>;

  const daysLeft = trialDaysLeft(db, 7);
  const premium = isPremium(db);
  const justOnboarded = !premium && db.profile.onboardingCompleted && !db.profile.trialStartedAt;

  return (
    <AppShell>
      <PageHeader
        eyebrow="Grovv Pro"
        title={
          <>
            One step <span className="text-gradient">unlocks everything</span>
          </>
        }
        subtitle={
          premium
            ? "You're on Grovv Pro. Thanks for supporting the app."
            : "Pick the plan that fits you. Or start with a free 7-day trial — no card needed."
        }
      />

      {justOnboarded && (
        <div className="mb-6 rounded-2xl border border-primary/30 bg-primary/8 p-4 sm:p-5 grovv-fade-up">
          <p className="text-[0.65rem] uppercase tracking-[0.16em] text-primary font-semibold">
            One last thing
          </p>
          <h2 className="font-display text-lg sm:text-xl font-semibold mt-1">
            Welcome to Grovv. Try Pro free for 7 days?
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            No credit card. Includes wellness, journal, focus timer, and insights. Auto-reverts to
            free when the trial ends.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={startFreeTrial}
              className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:shadow-glow transition-all"
            >
              Start 7-day free trial
            </button>
            <button
              type="button"
              onClick={() => void navigate({ to: "/" })}
              className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-[var(--surface-2)] transition-colors"
            >
              I'll pass this time
            </button>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-4">
        {PLANS.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            actionLabel="Choose this plan"
            onAction={() => setPendingPlan(plan.id)}
            disabled={false}
          />
        ))}
      </div>

      <p className="mt-3 text-center text-[0.65rem] text-muted-foreground">
        Paid checkout is disabled for now. Pro is granted manually — sign in with your email and
        ask us to approve it, and Pro unlocks automatically on this device.
      </p>

      <div className="mt-6 rounded-2xl border border-border bg-[var(--surface)] p-5 sm:p-6">
        <h3 className="font-display text-lg">Everything in Pro</h3>
        <ul className="mt-3 grid sm:grid-cols-2 gap-2">
          {PRO_FEATURES.map((f) => (
            <li
              key={f}
              className="flex items-start gap-2 rounded-xl border border-border bg-[var(--surface-2)] px-3 py-2 text-sm"
            >
              <span className="text-[color:var(--success)]">✓</span>
              <span>{f}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-4 grid lg:grid-cols-2 gap-4">
        <section className="rounded-2xl border border-border bg-[var(--surface)] p-5">
          <h3 className="font-display text-lg">7-day free trial</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Try every Pro feature for a week. No card, no email — just unlock.
          </p>
          <p className="mt-3 text-sm">
            Days left in trial: <strong>{daysLeft}</strong>
          </p>
          <button
            type="button"
            disabled={Boolean(db.profile.trialStartedAt)}
            onClick={startFreeTrial}
            className="mt-4 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {db.profile.trialStartedAt ? "Trial started" : "Start free trial"}
          </button>
        </section>

        <section className="rounded-2xl border border-border bg-[var(--surface)] p-5">
          <h3 className="font-display text-lg">How to get Pro right now</h3>
          <ol className="mt-2 list-decimal list-inside text-sm text-muted-foreground space-y-1">
            <li>
              Create an account or sign in from the{" "}
              <Link to="/account" className="font-semibold text-primary">
                Account
              </Link>{" "}
              page.
            </li>
            <li>Send us the email you signed in with so we can approve it.</li>
            <li>Once approved, Pro unlocks automatically — no payment needed.</li>
            <li>Sign in with that email on any device to carry Pro with you.</li>
          </ol>
          <p className="mt-3 text-xs text-muted-foreground">
            Paid plans above are coming soon. Approval is how access is granted today.
          </p>
        </section>
      </div>

      {pendingPlan && (
        <UpgradeModal
          plan={pendingPlan}
          email={email}
          setEmail={setEmail}
          onClose={() => setPendingPlan(null)}
          onSubmit={() => {
            updateProfile({ email: email.trim() });
            setPendingPlan(null);
          }}
        />
      )}
    </AppShell>
  );
}

function PlanCard({
  plan,
  actionLabel,
  disabled,
  onAction,
}: {
  plan: PlanOption;
  actionLabel: string;
  disabled?: boolean;
  onAction?: () => void;
}) {
  return (
    <article
      className={
        "rounded-2xl border p-5 flex flex-col relative " +
        (plan.highlight
          ? "border-primary/60 bg-primary/8 ring-1 ring-primary/40"
          : "border-border bg-[var(--surface)]")
      }
    >
      {plan.badge && (
        <span
          className={
            "absolute -top-2.5 left-5 rounded-full px-3 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.12em] " +
            (plan.highlight
              ? "bg-primary text-primary-foreground"
              : "bg-[var(--surface-2)] border border-border text-muted-foreground")
          }
        >
          {plan.badge}
        </span>
      )}
      <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">{plan.title}</p>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="font-display text-4xl font-bold leading-none">{plan.price}</span>
        <span className="text-sm text-muted-foreground">{plan.unit}</span>
      </div>
      <p className="text-sm text-muted-foreground mt-1">{plan.sub}</p>
      {plan.total && <p className="text-[0.65rem] text-muted-foreground mt-0.5">{plan.total}</p>}

      <button
        type="button"
        onClick={onAction}
        disabled={disabled}
        className={
          "mt-5 w-full rounded-full px-4 py-2.5 text-sm font-semibold disabled:opacity-50 transition-all " +
          (plan.highlight
            ? "bg-primary text-primary-foreground hover:shadow-glow"
            : "border border-border hover:bg-[var(--surface-2)]")
        }
      >
        {actionLabel}
      </button>
    </article>
  );
}

function UpgradeModal({
  plan,
  email,
  setEmail,
  onClose,
  onSubmit,
}: {
  plan: PlanId;
  email: string;
  setEmail: (v: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const valid = /\S+@\S+\.\S+/.test(email);
  const planLabel =
    plan === "pro_annual"
      ? "Pro Yearly ($19/yr)"
      : plan === "pro_lifetime"
        ? "Pro Lifetime ($49 one-time)"
        : "Pro Monthly ($1.97/mo)";
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
        className="w-full max-w-md rounded-3xl border border-border bg-[var(--surface)] p-6"
      >
        <p className="text-xs uppercase tracking-[0.14em] text-primary">Pro · {planLabel}</p>
        <h3 className="mt-2 font-display text-2xl font-bold">Request Pro access</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Enter the email you sign in with. Send it to us and we'll approve it — Pro then unlocks
          automatically wherever you're signed in with that email.
        </p>
        <input
          autoFocus
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@email.com"
          className="mt-4 w-full rounded-xl border border-border bg-[var(--surface-2)] px-4 py-3 text-base sm:text-sm focus:outline-none focus:border-primary/60"
        />
        <div className="mt-4 rounded-xl border border-border bg-[var(--surface-2)] p-3 text-xs text-muted-foreground">
          Paid checkout is disabled for now. Your email is saved on this device so you can copy it
          when requesting access.
        </div>
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-full border border-border px-4 py-2.5 text-sm font-semibold"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!valid}
            onClick={onSubmit}
            className="flex-1 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            Save my email
          </button>
        </div>
      </div>
    </div>
  );
}
