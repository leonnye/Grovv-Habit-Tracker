import { useEffect, useRef, useSyncExternalStore } from "react";
import { useAuth } from "./auth";
import {
  applyCloudSnapshot,
  exportDbSnapshot,
  getLocalDb,
  getLocalLastModifiedAt,
  hasUserData,
  updateProfile,
  useDb,
  type HabitDb,
} from "./habits";
import { getSupabase, initSupabase } from "./supabase";

type CloudRow = {
  user_id: string;
  snapshot: unknown;
  updated_at: string;
};

export type SyncStatus =
  | { state: "idle" }
  | { state: "syncing"; detail?: string }
  | { state: "ok"; at: string; habits: number; name: string }
  | { state: "error"; message: string };

const PUSH_DEBOUNCE_MS = 2500;

async function supabaseClient() {
  return (await initSupabase()) ?? getSupabase();
}

let applyingRemote = false;
let syncStatus: SyncStatus = { state: "idle" };
const syncListeners = new Set<() => void>();

function setSyncStatus(next: SyncStatus) {
  syncStatus = next;
  for (const l of syncListeners) l();
}

export function getSyncStatus(): SyncStatus {
  return syncStatus;
}

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(
    (l) => {
      syncListeners.add(l);
      return () => syncListeners.delete(l);
    },
    () => syncStatus,
    () => ({ state: "idle" }) as SyncStatus,
  );
}

function asDb(snapshot: unknown): HabitDb | null {
  if (!snapshot || typeof snapshot !== "object") return null;
  try {
    // migrateDb is applied inside applyCloudSnapshot; for scoring we read lightly.
    const raw = snapshot as Partial<HabitDb> & { habits?: unknown; profile?: { name?: string } };
    return {
      habits: Array.isArray(raw.habits) ? (raw.habits as HabitDb["habits"]) : [],
      checkins: (raw.checkins as HabitDb["checkins"]) ?? {},
      checkinMeta: (raw.checkinMeta as HabitDb["checkinMeta"]) ?? {},
      wellness: (raw.wellness as HabitDb["wellness"]) ?? {},
      journal: (raw.journal as HabitDb["journal"]) ?? {},
      freezesUsed: (raw.freezesUsed as HabitDb["freezesUsed"]) ?? {},
      profile: (raw.profile as HabitDb["profile"]) ?? getLocalDb().profile,
    };
  } catch {
    return null;
  }
}

/** Higher score = richer backup. Used so empty local can't wipe a full cloud copy. */
function richness(db: HabitDb | null): number {
  if (!db) return 0;
  const habitN = db.habits.length;
  const checkinN = Object.values(db.checkins).reduce((n, dates) => n + dates.length, 0);
  const wellnessN = Object.keys(db.wellness).length;
  const journalN = Object.keys(db.journal).length;
  const named = db.profile?.name?.trim() ? 2 : 0;
  return habitN * 100 + checkinN * 10 + wellnessN * 5 + journalN * 5 + named;
}

async function fetchCloudRow(userId: string): Promise<{ row: CloudRow | null; error: string | null }> {
  const sb = await supabaseClient();
  if (!sb) return { row: null, error: "Cloud isn't configured." };
  const { data, error } = await sb
    .from("user_data")
    .select("user_id, snapshot, updated_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return { row: null, error: error.message };
  return { row: (data as CloudRow | null) ?? null, error: null };
}

async function pushCloudRow(userId: string): Promise<{ ok: boolean; error?: string }> {
  const sb = await supabaseClient();
  if (!sb) return { ok: false, error: "Cloud isn't configured." };
  const db = getLocalDb();
  const snapshot = JSON.parse(exportDbSnapshot(db)) as unknown;
  const { error } = await sb.from("user_data").upsert(
    {
      user_id: userId,
      snapshot,
    },
    { onConflict: "user_id" },
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

function isNewer(isoA: string, isoB: string | null): boolean {
  if (!isoB) return true;
  const a = new Date(isoA).getTime();
  const b = new Date(isoB).getTime();
  if (isNaN(a)) return false;
  if (isNaN(b)) return true;
  return a > b;
}

function markOkFromLocal() {
  const db = getLocalDb();
  setSyncStatus({
    state: "ok",
    at: new Date().toISOString(),
    habits: db.habits.length,
    name: db.profile.name || "—",
  });
}

/**
 * Pull cloud backup and merge with local.
 * Prefer the richer snapshot when one side is sparse, so a fresh onboarding
 * on a new device can't wipe habits stored in the cloud.
 */
export async function pullAndMerge(userId: string): Promise<void> {
  setSyncStatus({ state: "syncing", detail: "Checking cloud backup…" });
  const local = getLocalDb();
  const localAt = getLocalLastModifiedAt();
  const { row: cloud, error } = await fetchCloudRow(userId);

  if (error) {
    setSyncStatus({ state: "error", message: error });
    return;
  }

  if (!cloud) {
    if (hasUserData(local)) {
      const pushed = await pushCloudRow(userId);
      if (!pushed.ok) {
        setSyncStatus({ state: "error", message: pushed.error ?? "Couldn't upload backup." });
        return;
      }
    }
    markOkFromLocal();
    return;
  }

  const cloudDb = asDb(cloud.snapshot);
  const localScore = richness(local);
  const cloudScore = richness(cloudDb);
  const cloudAt = cloud.updated_at;

  const preferCloud =
    !hasUserData(local) ||
    cloudScore > localScore + 20 ||
    (cloudScore >= localScore && isNewer(cloudAt, localAt)) ||
    (local.habits.length === 0 && (cloudDb?.habits.length ?? 0) > 0);

  if (preferCloud) {
    applyingRemote = true;
    try {
      applyCloudSnapshot(cloud.snapshot, cloudAt);
    } finally {
      applyingRemote = false;
    }
    markOkFromLocal();
    return;
  }

  // Local is richer or equally rich and newer — upload, but never overwrite a
  // clearly richer cloud with a near-empty local.
  if (localScore >= cloudScore && isNewer(localAt ?? "", cloudAt)) {
    const pushed = await pushCloudRow(userId);
    if (!pushed.ok) {
      setSyncStatus({ state: "error", message: pushed.error ?? "Couldn't upload backup." });
      return;
    }
  }

  markOkFromLocal();
}

/** Force restore from cloud (Account page). */
export async function restoreFromCloud(userId: string): Promise<{ ok: boolean; error?: string }> {
  setSyncStatus({ state: "syncing", detail: "Restoring from cloud…" });
  const { row: cloud, error } = await fetchCloudRow(userId);
  if (error) {
    setSyncStatus({ state: "error", message: error });
    return { ok: false, error };
  }
  if (!cloud) {
    const msg = "No cloud backup found for this account yet.";
    setSyncStatus({ state: "error", message: msg });
    return { ok: false, error: msg };
  }
  applyingRemote = true;
  try {
    applyCloudSnapshot(cloud.snapshot, cloud.updated_at);
  } finally {
    applyingRemote = false;
  }
  markOkFromLocal();
  return { ok: true };
}

/** Force upload current device data to cloud. */
export async function backupNow(userId: string): Promise<{ ok: boolean; error?: string }> {
  setSyncStatus({ state: "syncing", detail: "Uploading…" });
  const pushed = await pushCloudRow(userId);
  if (!pushed.ok) {
    setSyncStatus({ state: "error", message: pushed.error ?? "Upload failed." });
    return pushed;
  }
  markOkFromLocal();
  return { ok: true };
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
      setSyncStatus({ state: "idle" });
      return;
    }

    // Fill empty local name from the auth account display name.
    const authName =
      (auth.user?.user_metadata as { display_name?: string; full_name?: string } | undefined)
        ?.display_name ||
      (auth.user?.user_metadata as { display_name?: string; full_name?: string } | undefined)
        ?.full_name ||
      "";
    if (authName && !getLocalDb().profile.name.trim()) {
      updateProfile({ name: authName.trim().slice(0, 40), email: auth.user?.email ?? null });
    } else if (auth.user?.email && getLocalDb().profile.email !== auth.user.email) {
      updateProfile({ email: auth.user.email });
    }

    let cancelled = false;
    void (async () => {
      await pullAndMerge(userId);
      if (!cancelled) readyUserRef.current = userId;
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, auth.status, auth.user]);

  useEffect(() => {
    if (!userId || auth.status !== "ready") return;
    if (readyUserRef.current !== userId || applyingRemote) return;

    const timer = window.setTimeout(() => {
      if (applyingRemote) return;
      void pushCloudRow(userId).then((res) => {
        if (res.ok) markOkFromLocal();
        else if (res.error) setSyncStatus({ state: "error", message: res.error });
      });
    }, PUSH_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [db, userId, auth.status]);
}
