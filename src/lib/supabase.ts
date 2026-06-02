import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase is entirely optional in Grovv. The app falls back to local-only
 * mode when these env vars aren't configured, so we lazily construct the
 * client on the browser only (never during SSR — keeps the server bundle small
 * and avoids Netlify cold-start timeouts).
 */

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ?? "";
const SUPABASE_ANON_KEY =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() ?? "";

export type PhotoRow = {
  id: string;
  user_id: string;
  storage_path: string;
  caption: string | null;
  habit_id: string | null;
  logged_on: string;
  created_at: string;
};

let cached: SupabaseClient | null = null;
let initPromise: Promise<SupabaseClient | null> | null = null;

export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

/** Load the Supabase client in the browser (dynamic import — not in the SSR bundle). */
export function initSupabase(): Promise<SupabaseClient | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (!isSupabaseConfigured()) return Promise.resolve(null);
  if (cached) return Promise.resolve(cached);
  if (initPromise) return initPromise;

  initPromise = import("@supabase/supabase-js")
    .then(({ createClient }) => {
      cached = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storageKey: "grovv.auth",
        },
      });
      return cached;
    })
    .catch(() => null);

  return initPromise;
}

export function getSupabase(): SupabaseClient | null {
  if (typeof window === "undefined") return null;
  return cached;
}

export const PHOTOS_BUCKET = "photos";
