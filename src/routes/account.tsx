import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell, PageHeader } from "@/components/app-shell";
import {
  displayNameOf,
  sendMagicLink,
  signInWithEmail,
  signOut,
  signUpWithEmail,
  useAuth,
} from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase";
import { updateProfile, useDb, useMounted } from "@/lib/habits";
import { backupNow, restoreFromCloud, useSyncStatus } from "@/lib/sync";

export const Route = createFileRoute("/account")({ component: AccountPage });

type Mode = "signin" | "signup" | "magic";

function AccountPage() {
  const mounted = useMounted();
  const auth = useAuth();
  const db = useDb();
  const navigate = useNavigate();
  const configured = isSupabaseConfigured();

  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState(db.profile.name);
  const [email, setEmail] = useState(db.profile.email ?? "");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (!mounted) return <AppShell>{null}</AppShell>;

  const signedIn = Boolean(auth.user);

  const submit = async () => {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      if (mode === "magic") {
        const res = await sendMagicLink(email.trim());
        if (!res.ok) setError(res.error);
        else setNotice("Check your inbox for the sign-in link.");
        return;
      }
      const res =
        mode === "signin"
          ? await signInWithEmail(email.trim(), password)
          : await signUpWithEmail(email.trim(), password, name.trim() || undefined);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if (mode === "signup") {
        setNotice("Account created. Check your inbox if email confirmation is enabled.");
        if (name.trim()) updateProfile({ name: name.trim(), email: email.trim() });
        else updateProfile({ email: email.trim() });
      } else {
        updateProfile({ email: email.trim() });
        void navigate({ to: "/" });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell>
      <PageHeader
        eyebrow="Account"
        title={
          <>
            Your <span className="text-gradient">account</span>
          </>
        }
        subtitle="Sign in so your habits, wellness, journal, and photos are saved to your account — then pick up where you left off on any device."
      />

      {!configured && (
        <div className="mb-6 rounded-2xl border border-[color:var(--warning)]/40 bg-[color:var(--warning)]/10 p-4 sm:p-5">
          <p className="font-display text-sm sm:text-base font-semibold">
            Cloud sync isn't configured yet
          </p>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
            Add <code className="rounded bg-background px-1 py-0.5">VITE_SUPABASE_URL</code> and{" "}
            <code className="rounded bg-background px-1 py-0.5">VITE_SUPABASE_ANON_KEY</code> to
            your <code className="rounded bg-background px-1 py-0.5">.env</code>, then run the
            migration in <code>supabase/migrations</code>. Until then, photos and accounts stay
            disabled — but everything else works.
          </p>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2 max-w-4xl">
        <section className="rounded-2xl border border-border bg-[var(--surface)] p-5 sm:p-6">
          {signedIn ? (
            <SignedInPanel
              email={auth.user?.email ?? ""}
              name={displayNameOf(auth.user) || db.profile.name}
              userId={auth.user?.id ?? ""}
              habitCount={db.habits.length}
              profileName={db.profile.name}
              onSignOut={async () => {
                setBusy(true);
                try {
                  await signOut();
                } finally {
                  setBusy(false);
                }
              }}
              busy={busy}
            />
          ) : (
            <>
              <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
                <h3 className="font-display text-lg font-semibold">
                  {mode === "signup"
                    ? "Create an account"
                    : mode === "magic"
                      ? "Email me a link"
                      : "Sign in"}
                </h3>
                <ModeSwitcher mode={mode} setMode={setMode} />
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground mb-5">
                {mode === "signup"
                  ? "Use a real email so you can recover access later."
                  : mode === "magic"
                    ? "We'll send you a single-use link to sign in. No password needed."
                    : "Welcome back."}
              </p>

              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (busy || !configured) return;
                  void submit();
                }}
              >
                {mode === "signup" && (
                  <Field label="Display name (optional)">
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your name"
                      autoComplete="name"
                      className="w-full rounded-lg border border-border bg-[var(--surface-2)] px-3 py-2.5 text-base sm:text-sm focus:outline-none focus:border-primary/60"
                    />
                  </Field>
                )}
                <Field label="Email">
                  <input
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full rounded-lg border border-border bg-[var(--surface-2)] px-3 py-2.5 text-base sm:text-sm focus:outline-none focus:border-primary/60"
                  />
                </Field>
                {mode !== "magic" && (
                  <Field label="Password" hint="At least 6 characters.">
                    <input
                      type="password"
                      autoComplete={mode === "signup" ? "new-password" : "current-password"}
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full rounded-lg border border-border bg-[var(--surface-2)] px-3 py-2.5 text-base sm:text-sm focus:outline-none focus:border-primary/60"
                    />
                  </Field>
                )}

                {error && (
                  <p className="text-sm text-[color:var(--destructive)] break-words">{error}</p>
                )}
                {notice && (
                  <p className="text-sm text-[color:var(--success)] break-words">{notice}</p>
                )}

                <button
                  type="submit"
                  disabled={busy || !configured}
                  className="w-full rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50 hover:shadow-glow transition-all"
                >
                  {busy
                    ? "Working…"
                    : mode === "signup"
                      ? "Create account"
                      : mode === "magic"
                        ? "Send link"
                        : "Sign in"}
                </button>
              </form>
            </>
          )}
        </section>

        <aside className="space-y-4">
          <Card title="Why an account?">
            <ul className="text-xs sm:text-sm text-muted-foreground space-y-2">
              <li className="flex gap-2">
                <span aria-hidden>◎</span> Habits, check-ins, and streaks sync to your account
              </li>
              <li className="flex gap-2">
                <span aria-hidden>♡</span> Wellness logs and journal entries come with you
              </li>
              <li className="flex gap-2">
                <span aria-hidden>📸</span> Progress photos in a private cloud gallery
              </li>
              <li className="flex gap-2">
                <span aria-hidden>🔁</span> Sign in on another device and continue where you left off
              </li>
            </ul>
          </Card>
        </aside>
      </div>
    </AppShell>
  );
}

function ModeSwitcher({ mode, setMode }: { mode: Mode; setMode: (m: Mode) => void }) {
  const opts: { id: Mode; label: string }[] = [
    { id: "signin", label: "Sign in" },
    { id: "signup", label: "Sign up" },
    { id: "magic", label: "Magic link" },
  ];
  return (
    <div className="inline-flex rounded-full border border-border bg-[var(--surface-2)] p-0.5 text-xs">
      {opts.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => setMode(o.id)}
          className={
            "px-3 py-1.5 rounded-full transition-colors " +
            (mode === o.id ? "bg-primary text-primary-foreground" : "text-muted-foreground")
          }
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function SignedInPanel({
  email,
  name,
  userId,
  habitCount,
  profileName,
  onSignOut,
  busy,
}: {
  email: string;
  name: string;
  userId: string;
  habitCount: number;
  profileName: string;
  onSignOut: () => void;
  busy: boolean;
}) {
  const sync = useSyncStatus();
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  const syncLabel =
    sync.state === "syncing"
      ? sync.detail || "Syncing…"
      : sync.state === "error"
        ? `Sync error: ${sync.message}`
        : sync.state === "ok"
          ? `Synced · ${sync.habits} habit${sync.habits === 1 ? "" : "s"} · ${sync.name}`
          : "Waiting to sync…";

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="size-12 rounded-full bg-primary/15 text-primary grid place-items-center font-display text-xl font-bold">
          {(name || email || "?").slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="font-display text-base font-semibold truncate">
            {profileName || name || "Signed in"}
          </p>
          <p className="text-xs text-muted-foreground truncate">{email}</p>
        </div>
      </div>

      <div
        className={
          "rounded-xl border p-3 text-sm " +
          (sync.state === "error"
            ? "border-[color:var(--destructive)]/30 bg-[color:var(--destructive)]/10"
            : "border-[color:var(--success)]/30 bg-[color:var(--success)]/10")
        }
      >
        <p className="font-semibold">{syncLabel}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          On this device now: <strong className="text-foreground">{habitCount}</strong> habit
          {habitCount === 1 ? "" : "s"}
          {profileName ? (
            <>
              {" "}
              · name <strong className="text-foreground">{profileName}</strong>
            </>
          ) : null}
          . Data follows the email you sign in with — a different email is a different backup.
        </p>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={actionBusy || !userId}
          onClick={() => {
            setActionMsg(null);
            setActionBusy(true);
            void restoreFromCloud(userId).then((res) => {
              setActionBusy(false);
              setActionMsg(res.ok ? "Restored from cloud." : res.error || "Restore failed.");
            });
          }}
          className="rounded-full border border-border bg-[var(--surface-2)] px-4 py-2 text-xs font-semibold hover:border-primary/40 transition-colors disabled:opacity-50"
        >
          Restore from cloud
        </button>
        <button
          type="button"
          disabled={actionBusy || !userId}
          onClick={() => {
            setActionMsg(null);
            setActionBusy(true);
            void backupNow(userId).then((res) => {
              setActionBusy(false);
              setActionMsg(res.ok ? "Backup uploaded." : res.error || "Backup failed.");
            });
          }}
          className="rounded-full border border-border bg-[var(--surface-2)] px-4 py-2 text-xs font-semibold hover:border-primary/40 transition-colors disabled:opacity-50"
        >
          Backup this device
        </button>
      </div>
      {actionMsg && <p className="mt-2 text-xs text-muted-foreground">{actionMsg}</p>}

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          to="/photos"
          className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:shadow-glow transition-all"
        >
          Open Photos
        </Link>
        <button
          type="button"
          disabled={busy}
          onClick={onSignOut}
          className="rounded-full border border-border bg-[var(--surface-2)] px-5 py-2.5 text-sm font-semibold hover:border-[color:var(--destructive)]/40 hover:text-[color:var(--destructive)] transition-colors disabled:opacity-50"
        >
          Sign out
        </button>
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

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-[var(--surface)] p-5 sm:p-6">
      <h3 className="font-display text-base font-semibold mb-2">{title}</h3>
      {children}
    </div>
  );
}
