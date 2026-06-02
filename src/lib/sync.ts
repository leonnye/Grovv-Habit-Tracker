import { useEffect, useRef } from "react";
import { useAuth } from "./auth";
import {
  applyCloudSnapshot,
  exportDbSnapshot,
  getLocalDb,
  getLocalLastModifiedAt,
  hasUserData,
  useDb,
} from "./habits";
import { getSupabase, initSupabase } from "./supabase";

type CloudRow = {
  user_id: string;
  snapshot: unknown;
  updated_at: string;
};

const PUSH_DEBOUNCE_MS = 2500;

async function supabaseClient() {
  return (await initSupabase()) ?? getSupabase();
}

let applyingRemote = false;

async function fetchCloudRow(userId: string): Promise<CloudRow | null> {
  const sb = await supabaseClient();
  if (!sb) return null;
  const { data, error } = await sb
    .from("user_data")
    .select("user_id, snapshot, updated_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return data as CloudRow;
}

async function pushCloudRow(userId: string): Promise<boolean> {
  const sb = await supabaseClient();
  if (!sb) return false;
  const db = getLocalDb();
  const snapshot = JSON.parse(exportDbSnapshot(db)) as unknown;
  const { error } = await sb.from("user_data").upsert(
    {
      user_id: userId,
      snapshot,
    },
    { onConflict: "user_id" },
  );
  return !error;
}

function isNewer(isoA: string, isoB: string | null): boolean {
  if (!isoB) return true;
  const a = new Date(isoA).getTime();
  const b = new Date(isoB).getTime();
  if (isNaN(a)) return false;
  if (isNaN(b)) return true;
  return a > b;
}

/**
 * Pull cloud backup and merge with local using last-write-wins.
 * - Cloud only  -> restore cloud
 * - Local only  -> upload local
 * - Both        -> keep whichever was updated most recently
 */
export async function pullAndMerge(userId: string): Promise<void> {
  const local = getLocalDb();
  const localAt = getLocalLastModifiedAt();
  const cloud = await fetchCloudRow(userId);

  if (!cloud) {
    if (hasUserData(local)) await pushCloudRow(userId);
    return;
  }

  const cloudAt = cloud.updated_at;
  const localHasData = hasUserData(local);

  if (!localHasData) {
    applyingRemote = true;
    try {
      applyCloudSnapshot(cloud.snapshot, cloudAt);
    } finally {
      applyingRemote = false;
    }
    return;
  }

  if (isNewer(cloudAt, localAt)) {
    applyingRemote = true;
    try {
      applyCloudSnapshot(cloud.snapshot, cloudAt);
    } finally {
      applyingRemote = false;
    }
    return;
  }

  if (isNewer(localAt ?? "", cloudAt)) {
    await pushCloudRow(userId);
  }
}

/**
 * Keeps habits, wellness, journal, and profile in sync when signed in.
 * Mount once near the app root.
 */
export function useCloudSync() {
  const auth = useAuth();
  const db = useDb();
  const userId = auth.user?.id ?? null;
  const readyUserRef = useRef<string | null>(null);

  useEffect(() => {
    if (auth.status !== "ready") return;

    if (!userId) {
      readyUserRef.current = null;
      return;
    }

    let cancelled = false;
    void (async () => {
      await pullAndMerge(userId);
      if (!cancelled) readyUserRef.current = userId;
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, auth.status]);

  useEffect(() => {
    if (!userId || auth.status !== "ready") return;
    if (readyUserRef.current !== userId || applyingRemote) return;

    const timer = window.setTimeout(() => {
      if (applyingRemote) return;
      void pushCloudRow(userId);
    }, PUSH_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [db, userId, auth.status]);
}
