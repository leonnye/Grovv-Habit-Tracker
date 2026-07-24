import type { Session, User } from "@supabase/supabase-js";
import { useSyncExternalStore } from "react";
import { getSupabase, initSupabase, isSupabaseConfigured } from "./supabase";

/**
 * Tiny auth store. Sign-in is optional — when Supabase isn't configured
 * (or the user simply chooses to stay anonymous), the store is just empty
 * and every part of the app keeps working in local-only mode.
 */

type AuthState = {
  status: "loading" | "ready";
  session: Session | null;
  user: User | null;
};

let state: AuthState = {
  status: isSupabaseConfigured() ? "loading" : "ready",
  session: null,
  user: null,
};

const SERVER_STATE: AuthState = { status: "ready", session: null, user: null };
const listeners = new Set<() => void>();
let initialized = false;

function emit() {
  for (const l of listeners) l();
}

function setState(next: Partial<AuthState>) {
  state = { ...state, ...next };
  emit();
}

function ensureSubscribed() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;

  if (!isSupabaseConfigured()) {
    setState({ status: "ready" });
    return;
  }

  // Safety net: if session restore hangs (paused project / long idle),
  // unblock the UI quickly. A later auth event can still update the store.
  const failSafe = window.setTimeout(() => {
    if (state.status === "loading") setState({ status: "ready" });
  }, 2500);

  void initSupabase().then((sb) => {
    if (!sb) {
      window.clearTimeout(failSafe);
      setState({ status: "ready" });
      return;
    }
    void sb.auth
      .getSession()
      .then(({ data }) => {
        window.clearTimeout(failSafe);
        setState({
          status: "ready",
          session: data.session ?? null,
          user: data.session?.user ?? null,
        });
      })
      .catch(() => {
        window.clearTimeout(failSafe);
        setState({ status: "ready" });
      });
    sb.auth.onAuthStateChange((_event, session) => {
      setState({
        status: "ready",
        session: session ?? null,
        user: session?.user ?? null,
      });
    });
  });
}

function subscribe(l: () => void) {
  ensureSubscribed();
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useAuth(): AuthState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => SERVER_STATE,
  );
}

export type AuthResult = { ok: true } | { ok: false; error: string };

async function clientSupabase() {
  return (await initSupabase()) ?? getSupabase();
}

/** Turn opaque network errors into something a person can act on. */
function friendlyAuthError(err: unknown): string {
  const raw =
    err && typeof err === "object" && "message" in err && typeof (err as { message: unknown }).message === "string"
      ? (err as { message: string }).message
      : err instanceof Error
        ? err.message
        : String(err ?? "Something went wrong.");
  const msg = raw.toLowerCase();
  if (
    msg.includes("failed to fetch") ||
    msg.includes("networkerror") ||
    msg.includes("network request failed") ||
    msg.includes("load failed") ||
    msg.includes("fetch failed")
  ) {
    return "Can't reach the cloud right now. Your Supabase project may be paused — open the Supabase dashboard, restore the project, wait a minute, then try again.";
  }
  return raw;
}

export async function signUpWithEmail(
  email: string,
  password: string,
  name?: string,
): Promise<AuthResult> {
  const sb = await clientSupabase();
  if (!sb) return { ok: false, error: "Cloud sync isn't configured for this build." };
  try {
    const { error } = await sb.auth.signUp({
      email,
      password,
      options: {
        data: name ? { display_name: name } : undefined,
      },
    });
    if (error) return { ok: false, error: friendlyAuthError(error) };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: friendlyAuthError(err) };
  }
}

export async function signInWithEmail(email: string, password: string): Promise<AuthResult> {
  const sb = await clientSupabase();
  if (!sb) return { ok: false, error: "Cloud sync isn't configured for this build." };
  try {
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) return { ok: false, error: friendlyAuthError(error) };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: friendlyAuthError(err) };
  }
}

export async function sendMagicLink(email: string): Promise<AuthResult> {
  const sb = await clientSupabase();
  if (!sb) return { ok: false, error: "Cloud sync isn't configured for this build." };
  try {
    const { error } = await sb.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
      },
    });
    if (error) return { ok: false, error: friendlyAuthError(error) };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: friendlyAuthError(err) };
  }
}

export async function signOut(): Promise<void> {
  const sb = await clientSupabase();
  if (!sb) return;
  await sb.auth.signOut();
}

export function displayNameOf(user: User | null): string {
  if (!user) return "";
  const meta = (user.user_metadata ?? {}) as { display_name?: string; full_name?: string };
  return meta.display_name?.trim() || meta.full_name?.trim() || (user.email?.split("@")[0] ?? "");
}
