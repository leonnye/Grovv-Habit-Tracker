import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell, PageHeader } from "@/components/app-shell";
import {
  exportDbSnapshot,
  importDbSnapshot,
  isPremium,
  resetDb,
  setVacation,
  trialDaysLeft,
  updateProfile,
  useDb,
  useMounted,
} from "@/lib/habits";
import { dbToCsv } from "@/lib/csv";
import { requestNotificationPermission } from "@/lib/reminders";
import { displayNameOf, signOut, useAuth } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase";

export const Route = createFileRoute("/settings")({ component: SettingsPage });

function SettingsPage() {
  const db = useDb();
  const mounted = useMounted();
  const auth = useAuth();
  const cloudConfigured = isSupabaseConfigured();
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [name, setName] = useState(db.profile.name);
  const initialPermission =
    typeof window !== "undefined" && "Notification" in window
      ? Notification.permission
      : "unsupported";
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    initialPermission as NotificationPermission | "unsupported",
  );

  if (!mounted) return <AppShell>{null}</AppShell>;

  const exportData = () => {
    const blob = new Blob([exportDbSnapshot(db)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `grovv-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportCsv = () => {
    const blob = new Blob([dbToCsv(db)], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `grovv-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const premium = isPremium(db);
  const habitsWithReminder = db.habits.filter((h) => h.reminderTime);
  const habitsWithoutReminder = db.habits.filter((h) => !h.reminderTime);

  const onImportFile = async (file: File | null) => {
    if (!file) return;
    setImportError(null);
    setImportMessage(null);
    try {
      const text = await file.text();
      importDbSnapshot(text);
      setImportMessage("Import complete. Your local data has been updated.");
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Failed to import JSON file.");
    }
  };

  const onReset = () => {
    resetDb();
    setConfirmResetOpen(false);
    setImportMessage("All local data has been erased.");
    setImportError(null);
  };

  return (
    <AppShell>
      <PageHeader
        eyebrow="Account"
        title={
          <>
            Settings & <span className="text-gradient">your space</span>
          </>
        }
        subtitle="Reminders, profile, vacation, and data — everything you can tweak lives here."
      />

      <div className="grid lg:grid-cols-2 gap-4 max-w-4xl">
        {/* Profile */}
        <Card title="Profile" desc="Personalize your greeting and identity statement.">
          <div className="w-full grid gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Display name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="rounded-lg border border-border bg-[var(--surface-2)] px-3 py-2 text-sm"
              />
            </label>
            <button
              type="button"
              onClick={() => updateProfile({ name: name.trim() })}
              className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground self-start"
            >
              Save name
            </button>
          </div>
        </Card>

        {/* Reminders (moved here) */}
        <Card
          title="Reminders"
          desc="Master switch and notification permission for habit reminders."
        >
          <div className="w-full">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="text-xs text-muted-foreground">
                Browser permission:{" "}
                <strong className="text-foreground">{String(permission)}</strong>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => updateProfile({ remindersEnabled: !db.profile.remindersEnabled })}
                  className={
                    "rounded-full px-4 py-2 text-sm font-semibold border " +
                    (db.profile.remindersEnabled
                      ? "border-primary/60 bg-primary/15"
                      : "border-border")
                  }
                >
                  {db.profile.remindersEnabled ? "Enabled" : "Disabled"}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const next = await requestNotificationPermission();
                    if (next === "unsupported") return;
                    setPermission(next);
                  }}
                  className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                >
                  Request permission
                </button>
              </div>
            </div>

            <div className="mt-4 flex items-start gap-3 rounded-xl border border-border bg-[var(--surface-2)] p-3">
              <input
                id="adaptive"
                type="checkbox"
                className="mt-1"
                checked={db.profile.adaptiveReminders}
                onChange={(e) => updateProfile({ adaptiveReminders: e.target.checked })}
              />
              <label htmlFor="adaptive" className="text-xs">
                <span className="font-semibold text-sm text-foreground">Adaptive reminders</span>
                <p className="text-muted-foreground mt-0.5">
                  After 5+ check-ins for a habit, reminders shift to your usual completion time.
                </p>
              </label>
            </div>

            <div className="mt-4">
              <div className="text-[0.65rem] uppercase tracking-[0.1em] text-muted-foreground mb-2">
                Habits with reminders
              </div>
              {habitsWithReminder.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  None yet. Edit a habit and turn on its reminder time.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {habitsWithReminder.map((h) => (
                    <li
                      key={h.id}
                      className="flex items-center justify-between rounded-lg border border-border bg-[var(--surface-2)] px-3 py-2"
                    >
                      <span className="text-sm flex items-center gap-2 truncate">
                        <span>{h.icon}</span>
                        <span className="truncate">{h.name}</span>
                      </span>
                      <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[0.7rem] font-semibold shrink-0">
                        🔔 {h.reminderTime}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {habitsWithoutReminder.length > 0 && (
                <p className="mt-2 text-[0.7rem] text-muted-foreground">
                  {habitsWithoutReminder.length} habit
                  {habitsWithoutReminder.length === 1 ? "" : "s"} without reminders ·{" "}
                  <Link to="/habits" className="text-primary font-semibold">
                    Manage
                  </Link>
                </p>
              )}
            </div>
          </div>
        </Card>

        {/* Streak protection: vacation + freezes */}
        <Card
          title="Streak protection"
          desc="Keep streaks alive when life happens. Vacation pauses everything; freezes cover one missed day."
        >
          <div className="w-full grid gap-3">
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-[var(--surface-2)] p-3">
              <div>
                <p className="text-sm font-semibold">Vacation mode</p>
                <p className="text-xs text-muted-foreground">
                  Streaks won't break while this is on.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setVacation(!db.profile.vacationActive)}
                aria-pressed={db.profile.vacationActive}
                className={
                  "relative w-12 h-7 rounded-full transition-colors " +
                  (db.profile.vacationActive
                    ? "bg-primary"
                    : "bg-[var(--surface)] border border-border")
                }
              >
                <span
                  className={
                    "absolute top-0.5 size-6 rounded-full bg-white shadow transition-all " +
                    (db.profile.vacationActive ? "left-[1.4rem]" : "left-0.5")
                  }
                />
              </button>
            </div>
            <div className="rounded-xl border border-border bg-[var(--surface-2)] p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Streak freezes this month</p>
                <span className="font-display text-xl font-bold">{db.profile.freezeBalance}/2</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Use a freeze to protect a streak after missing a day. Auto-replenishes monthly.
              </p>
            </div>
          </div>
        </Card>

        {/* Pro */}
        <Card
          title={premium ? "Grovv Pro" : "Upgrade"}
          desc={
            premium
              ? "You're on Pro. Thanks for supporting the app."
              : "Unlock wellness, journal, focus timer, CSV export and insights."
          }
        >
          <div className="w-full flex flex-wrap gap-2 items-center">
            <Link
              to="/pricing"
              className="bg-primary text-primary-foreground px-5 py-2 rounded-full text-sm font-medium hover:shadow-glow transition-all"
            >
              {premium ? "Manage Pro" : "See plans"}
            </Link>
            <Pill>Trial days left: {trialDaysLeft(db)}</Pill>
          </div>
        </Card>

        <Card
          title="Account & cloud sync"
          desc={
            cloudConfigured
              ? auth.user
                ? "You're signed in. Progress photos sync to your private account."
                : "Sign in to back up data and use the photo gallery — totally optional."
              : "Local-only mode. Cloud sync isn't configured in this build."
          }
        >
          {auth.user ? (
            <div className="w-full flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="size-9 rounded-full bg-primary/15 text-primary grid place-items-center font-display font-bold">
                  {(displayNameOf(auth.user) || auth.user.email || "?").slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">
                    {displayNameOf(auth.user) || "Signed in"}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{auth.user.email}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 ml-auto">
                <Link
                  to="/photos"
                  className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
                >
                  Open Photos
                </Link>
                <button
                  type="button"
                  onClick={() => void signOut()}
                  className="rounded-full border border-border bg-[var(--surface-2)] px-4 py-2 text-xs font-semibold hover:border-[color:var(--destructive)]/40 hover:text-[color:var(--destructive)] transition-colors"
                >
                  Sign out
                </button>
              </div>
            </div>
          ) : (
            <div className="w-full flex flex-wrap items-center gap-2">
              <Pill>{cloudConfigured ? "Sign-in optional" : "Local-only"}</Pill>
              <Pill>Offline-first</Pill>
              <Link
                to="/account"
                className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground ml-auto"
              >
                {cloudConfigured ? "Sign in / sign up" : "Configure sync"}
              </Link>
            </div>
          )}
        </Card>

        <Card
          title="Export your data"
          desc="Download a snapshot of all your habits, check-ins, wellness logs, and journal."
        >
          <div className="flex flex-wrap gap-2 items-center w-full">
            <button
              type="button"
              onClick={exportData}
              className="bg-primary text-primary-foreground px-5 py-2 rounded-full text-sm font-medium hover:shadow-glow transition-all"
            >
              Download JSON
            </button>
            {premium ? (
              <button
                type="button"
                onClick={exportCsv}
                className="border border-primary/40 text-foreground px-5 py-2 rounded-full text-sm font-medium hover:bg-primary/10 transition-colors"
              >
                Download CSV
              </button>
            ) : (
              <Link
                to="/pricing"
                className="border border-border px-5 py-2 rounded-full text-sm font-medium text-muted-foreground hover:bg-[var(--surface-2)] transition-colors"
              >
                💎 CSV export · Pro
              </Link>
            )}
          </div>
        </Card>

        <Card
          title="Import backup"
          desc="Import a previously exported JSON snapshot. This replaces your current local data."
        >
          <label className="inline-flex cursor-pointer items-center rounded-full border border-border bg-[var(--surface-2)] px-4 py-2 text-sm font-medium hover:border-primary/50 transition-colors">
            Choose JSON file
            <input
              type="file"
              accept="application/json,.json"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                void onImportFile(file);
                e.currentTarget.value = "";
              }}
            />
          </label>
          {importMessage && (
            <p className="w-full text-sm text-[color:var(--success)]">{importMessage}</p>
          )}
          {importError && (
            <p className="w-full text-sm text-[color:var(--destructive)]">{importError}</p>
          )}
        </Card>

        <Card title="Stats">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full">
            <Stat label="Habits" value={db.habits.length} />
            <Stat
              label="Check-ins"
              value={Object.values(db.checkins).reduce((a, b) => a + b.length, 0)}
            />
            <Stat label="Wellness" value={Object.keys(db.wellness).length} />
            <Stat label="Journal" value={Object.keys(db.journal).length} />
          </div>
        </Card>

        <Card
          title="Reset everything"
          desc="Permanently erase all data on this device. This cannot be undone."
        >
          <button
            type="button"
            onClick={() => setConfirmResetOpen(true)}
            className="border border-[color:var(--destructive)]/40 text-[color:var(--destructive)] px-5 py-2 rounded-full text-sm font-medium hover:bg-[color:var(--destructive)]/10 transition-colors"
          >
            Erase all data
          </button>
        </Card>
      </div>

      {confirmResetOpen && (
        <ConfirmDialog
          title="Erase all data?"
          description="This permanently deletes all habits, check-ins, wellness logs, and journal entries on this device."
          confirmLabel="Erase everything"
          onCancel={() => setConfirmResetOpen(false)}
          onConfirm={onReset}
        />
      )}
    </AppShell>
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
        aria-labelledby="confirm-title"
        className="w-full max-w-md rounded-2xl border border-border bg-[var(--surface)] p-6"
      >
        <h3 id="confirm-title" className="font-display text-xl font-bold">
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

function Card({
  title,
  desc,
  children,
}: {
  title: string;
  desc?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-[var(--surface)] p-5 sm:p-6">
      <h3 className="font-display text-base font-semibold">{title}</h3>
      {desc && <p className="text-sm text-muted-foreground mt-1 mb-4">{desc}</p>}
      <div className="flex flex-wrap gap-2 mt-3 items-center">{children}</div>
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-xs px-3 py-1 rounded-full bg-[var(--surface-2)] border border-border text-muted-foreground">
      {children}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-[var(--surface-2)] p-3 text-center">
      <div className="font-display text-2xl font-bold">{value}</div>
      <div className="text-[0.65rem] uppercase tracking-[0.08em] text-muted-foreground mt-0.5">
        {label}
      </div>
    </div>
  );
}
