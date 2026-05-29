import type { Session, User } from "@supabase/supabase-js";
import { useSyncExternalStore } from "react";
import { getSupabase, isSupabaseConfigured } from "./supabase";

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
  const sb = getSupabase();
  if (!sb) {
    initialized = true;
    setState({ status: "ready" });
    return;
  }
  initialized = true;
  void sb.auth.getSession().then(({ data }) => {
    setState({
      status: "ready",
      session: data.session ?? null,
      user: data.session?.user ?? null,
    });
  });
  sb.auth.onAuthStateChange((_event, session) => {
    setState({
      status: "ready",
      session: session ?? null,
      user: session?.user ?? null,
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

export async function signUpWithEmail(
  email: string,
  password: string,
  name?: string,
): Promise<AuthResult> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: "Cloud sync isn't configured for this build." };
  const { error } = await sb.auth.signUp({
    email,
    password,
    options: {
      data: name ? { display_name: name } : undefined,
    },
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function signInWithEmail(email: string, password: string): Promise<AuthResult> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: "Cloud sync isn't configured for this build." };
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function sendMagicLink(email: string): Promise<AuthResult> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: "Cloud sync isn't configured for this build." };
  const { error } = await sb.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
    },
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function signOut(): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  await sb.auth.signOut();
}

export function displayNameOf(user: User | null): string {
  if (!user) return "";
  const meta = (user.user_metadata ?? {}) as { display_name?: string; full_name?: string };
  return meta.display_name?.trim() || meta.full_name?.trim() || (user.email?.split("@")[0] ?? "");
}
