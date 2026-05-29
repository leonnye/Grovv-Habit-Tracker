import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase is entirely optional in Grovv. The app falls back to local-only
 * mode when these env vars aren't configured, so we lazily construct the
 * client and expose a small helper to check whether cloud features are on.
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

export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (cached) return cached;
  cached = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: "grovv.auth",
    },
  });
  return cached;
}

export const PHOTOS_BUCKET = "photos";
