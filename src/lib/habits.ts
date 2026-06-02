import { useEffect, useState, useSyncExternalStore } from "react";

export type HabitFrequency = "daily" | "weekdays" | "weekends";

export type Habit = {
  id: string;
  name: string;
  icon: string; // emoji
  color: "purple" | "green" | "amber" | "teal" | "coral" | "pink";
  createdAt: string; // ISO date
  reminderTime?: string; // "HH:MM"
  identity?: string; // "I am someone who..."
  frequency: HabitFrequency;
  stackAfterId?: string; // habit-stacking: "after I {stackAfterId}, I {this}"
  defaultTimerMin?: number; // habit-specific timer preset in minutes
};

export type WellnessLog = {
  date: string; // YYYY-MM-DD
  sleepHours?: number;
  mood?: 1 | 2 | 3 | 4 | 5;
  waterLiters?: number;
  note?: string; // free-form note logged with the day's mood
};

export type JournalEntry = {
  date: string; // YYYY-MM-DD
  text: string;
  tags: string[];
  updatedAt: string; // ISO
};

export type CheckinMeta = {
  note?: string;
  loggedAt?: string; // ISO timestamp the checkin was made — used for adaptive reminders
};

export type ThemePreference = "light" | "dark" | "system";

export type UserProfile = {
  name: string;
  identity: string;
  onboardingCompleted: boolean;
  focusAreas: string[];
  trialStartedAt: string | null;
  plan: "free" | "pro_monthly" | "pro_annual" | "pro_lifetime";
  remindersEnabled: boolean;
  email: string | null;
  vacationActive: boolean;
  vacationStartedAt: string | null;
  freezeMonth: string; // YYYY-MM — month the balance was last reset
  freezeBalance: number; // freezes left this month (capped at 2)
  adaptiveReminders: boolean;
  theme: ThemePreference;
  lastPremiumPromptAt: string | null; // ISO — when we last showed the weekly upgrade modal
  cloudPremium: boolean; // Pro granted by email approval in Supabase (payment stays off)
};

export type HabitDb = {
  habits: Habit[];
  checkins: Record<string, string[]>;
  checkinMeta: Record<string, Record<string, CheckinMeta>>; // habitId -> date -> meta
  wellness: Record<string, WellnessLog>;
  journal: Record<string, JournalEntry>; // date -> entry
  freezesUsed: Record<string, string[]>; // habitId -> dates marked frozen
  profile: UserProfile;
};

type PersistedDbV6 = HabitDb & { version: 6 };

const KEY = "grovv.db.v6";
const SYNC_META_KEY = "grovv.sync.meta";
const LEGACY_KEYS = [
  "grovv.db.v5",
  "grovv.db.v4",
  "habitflow.db.v3",
  "habitflow.db.v2",
  "habitflow.db.v1",
  "grovv.db.v3",
] as const;

const FREEZES_PER_MONTH = 2;

const COLOR_MAP: Record<Habit["color"], string> = {
  purple: "oklch(0.66 0.18 285)",
  green: "oklch(0.78 0.18 158)",
  amber: "oklch(0.79 0.155 75)",
  teal: "oklch(0.78 0.13 190)",
  coral: "oklch(0.72 0.18 22)",
  pink: "oklch(0.78 0.12 350)",
};

export const habitColor = (c: Habit["color"]) => COLOR_MAP[c];

function ymdToParts(key: string) {
  return { yyyy: key.slice(0, 4), mm: key.slice(5, 7) };
}

function currentYearMonth(at = new Date()) {
  return `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, "0")}`;
}

export function defaultProfile(): UserProfile {
  return {
    name: "",
    identity: "",
    onboardingCompleted: false,
    focusAreas: [],
    trialStartedAt: null,
    plan: "free",
    remindersEnabled: false,
    email: null,
    vacationActive: false,
    vacationStartedAt: null,
    freezeMonth: currentYearMonth(),
    freezeBalance: FREEZES_PER_MONTH,
    adaptiveReminders: false,
    theme: "system",
    lastPremiumPromptAt: null,
    cloudPremium: false,
  };
}

export function defaultDb(): HabitDb {
  return {
    habits: [],
    checkins: {},
    checkinMeta: {},
    wellness: {},
    journal: {},
    freezesUsed: {},
    profile: defaultProfile(),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isDateKey(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isReminderTime(value: unknown): value is string {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function sanitizeHabitColor(value: unknown): Habit["color"] {
  if (typeof value !== "string") return "purple";
  return (value in COLOR_MAP ? value : "purple") as Habit["color"];
}

function sanitizeFrequency(value: unknown): HabitFrequency {
  return value === "weekdays" || value === "weekends" ? value : "daily";
}

function sanitizeProfile(input: unknown): UserProfile {
  const fallback = defaultProfile();
  if (!isRecord(input)) return fallback;
  const balanceRaw =
    typeof input.freezeBalance === "number" ? input.freezeBalance : FREEZES_PER_MONTH;
  const validPlans: UserProfile["plan"][] = ["free", "pro_monthly", "pro_annual", "pro_lifetime"];
  const validThemes: ThemePreference[] = ["light", "dark", "system"];
  return {
    name: typeof input.name === "string" ? input.name.trim().slice(0, 40) : "",
    identity: typeof input.identity === "string" ? input.identity.trim().slice(0, 80) : "",
    onboardingCompleted: Boolean(input.onboardingCompleted),
    focusAreas: Array.isArray(input.focusAreas)
      ? input.focusAreas.filter((a): a is string => typeof a === "string").slice(0, 8)
      : [],
    trialStartedAt:
      typeof input.trialStartedAt === "string" && input.trialStartedAt
        ? input.trialStartedAt
        : null,
    plan: validPlans.includes(input.plan as UserProfile["plan"])
      ? (input.plan as UserProfile["plan"])
      : "free",
    remindersEnabled: Boolean(input.remindersEnabled),
    email: typeof input.email === "string" && /\S+@\S+\.\S+/.test(input.email) ? input.email : null,
    vacationActive: Boolean(input.vacationActive),
    vacationStartedAt:
      typeof input.vacationStartedAt === "string" && input.vacationStartedAt
        ? input.vacationStartedAt
        : null,
    freezeMonth:
      typeof input.freezeMonth === "string" && /^\d{4}-\d{2}$/.test(input.freezeMonth)
        ? input.freezeMonth
        : fallback.freezeMonth,
    freezeBalance: Math.max(0, Math.min(FREEZES_PER_MONTH, Math.floor(balanceRaw))),
    adaptiveReminders: Boolean(input.adaptiveReminders),
    theme: validThemes.includes(input.theme as ThemePreference)
      ? (input.theme as ThemePreference)
      : "system",
    lastPremiumPromptAt:
      typeof input.lastPremiumPromptAt === "string" && input.lastPremiumPromptAt
        ? input.lastPremiumPromptAt
        : null,
    cloudPremium: Boolean(input.cloudPremium),
  };
}

function sanitizeHabit(h: Record<string, unknown>): Habit {
  const name = typeof h.name === "string" ? h.name.trim() : "";
  const reminder = isReminderTime(h.reminderTime) ? (h.reminderTime as string) : undefined;
  const stackAfterId =
    typeof h.stackAfterId === "string" && h.stackAfterId ? h.stackAfterId : undefined;
  const defaultTimerMinRaw = h.defaultTimerMin;
  const defaultTimerMin =
    typeof defaultTimerMinRaw === "number" && defaultTimerMinRaw > 0 && defaultTimerMinRaw <= 240
      ? Math.round(defaultTimerMinRaw)
      : undefined;
  return {
    id: typeof h.id === "string" && h.id ? h.id : crypto.randomUUID(),
    name: name || "Untitled habit",
    icon: typeof h.icon === "string" && h.icon ? h.icon : "🎯",
    color: sanitizeHabitColor(h.color),
    createdAt:
      typeof h.createdAt === "string" && h.createdAt ? h.createdAt : new Date().toISOString(),
    reminderTime: reminder,
    identity: typeof h.identity === "string" && h.identity ? h.identity.slice(0, 80) : undefined,
    frequency: sanitizeFrequency(h.frequency),
    stackAfterId,
    defaultTimerMin,
  };
}

function sanitizeCheckinMeta(input: unknown): CheckinMeta {
  if (!isRecord(input)) return {};
  return {
    note:
      typeof input.note === "string" && input.note.trim()
        ? input.note.trim().slice(0, 500)
        : undefined,
    loggedAt: typeof input.loggedAt === "string" && input.loggedAt ? input.loggedAt : undefined,
  };
}

function sanitizeJournal(input: unknown): JournalEntry | null {
  if (!isRecord(input)) return null;
  if (!isDateKey(input.date)) return null;
  const text = typeof input.text === "string" ? input.text.slice(0, 5000) : "";
  if (!text.trim()) return null;
  const tags = Array.isArray(input.tags)
    ? input.tags.filter((t): t is string => typeof t === "string").slice(0, 8)
    : [];
  const updatedAt =
    typeof input.updatedAt === "string" && input.updatedAt
      ? input.updatedAt
      : new Date().toISOString();
  return { date: input.date, text, tags, updatedAt };
}

function sanitizeDb(input: unknown): HabitDb {
  if (!isRecord(input)) return defaultDb();

  const habitsInput = Array.isArray(input.habits) ? input.habits : [];
  const habits: Habit[] = habitsInput.filter((h) => isRecord(h)).map((h) => sanitizeHabit(h));
  const habitIds = new Set(habits.map((h) => h.id));

  // Resolve dangling stackAfterId references
  for (const h of habits) {
    if (h.stackAfterId && !habitIds.has(h.stackAfterId)) {
      h.stackAfterId = undefined;
    }
  }

  const checkinsRaw = isRecord(input.checkins) ? input.checkins : {};
  const checkins: Record<string, string[]> = {};
  for (const habit of habits) {
    const listRaw = checkinsRaw[habit.id];
    const list = Array.isArray(listRaw) ? listRaw.filter(isDateKey) : [];
    checkins[habit.id] = Array.from(new Set(list)).sort();
  }

  const checkinMetaRaw = isRecord(input.checkinMeta) ? input.checkinMeta : {};
  const checkinMeta: Record<string, Record<string, CheckinMeta>> = {};
  for (const habit of habits) {
    const inner = isRecord(checkinMetaRaw[habit.id]) ? checkinMetaRaw[habit.id] : {};
    const meta: Record<string, CheckinMeta> = {};
    for (const [date, value] of Object.entries(inner as Record<string, unknown>)) {
      if (!isDateKey(date)) continue;
      const m = sanitizeCheckinMeta(value);
      if (m.note || m.loggedAt) meta[date] = m;
    }
    checkinMeta[habit.id] = meta;
  }

  const wellnessRaw = isRecord(input.wellness) ? input.wellness : {};
  const wellness: Record<string, WellnessLog> = {};
  for (const [date, row] of Object.entries(wellnessRaw)) {
    if (!isDateKey(date) || !isRecord(row)) continue;
    wellness[date] = {
      date,
      sleepHours: typeof row.sleepHours === "number" ? row.sleepHours : undefined,
      mood:
        typeof row.mood === "number" && row.mood >= 1 && row.mood <= 5
          ? (row.mood as 1 | 2 | 3 | 4 | 5)
          : undefined,
      waterLiters: typeof row.waterLiters === "number" ? row.waterLiters : undefined,
      note:
        typeof row.note === "string" && row.note.trim() ? row.note.trim().slice(0, 500) : undefined,
    };
  }

  const journalRaw = isRecord(input.journal) ? input.journal : {};
  const journal: Record<string, JournalEntry> = {};
  for (const [date, value] of Object.entries(journalRaw)) {
    if (!isDateKey(date)) continue;
    const entry = sanitizeJournal(value);
    if (entry) journal[date] = entry;
  }

  const freezesRaw = isRecord(input.freezesUsed) ? input.freezesUsed : {};
  const freezesUsed: Record<string, string[]> = {};
  for (const habit of habits) {
    const listRaw = freezesRaw[habit.id];
    const list = Array.isArray(listRaw) ? listRaw.filter(isDateKey) : [];
    freezesUsed[habit.id] = Array.from(new Set(list)).sort();
  }

  const profile = sanitizeProfile(input.profile);

  return { habits, checkins, checkinMeta, wellness, journal, freezesUsed, profile };
}

export function migrateDb(input: unknown): HabitDb {
  if (!isRecord(input)) return defaultDb();
  return sanitizeDb(input);
}

function loadPersistedRaw(): unknown {
  if (typeof window === "undefined") return null;

  const readKey = (key: string) => {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      return null;
    }
  };

  const current = readKey(KEY);
  if (current) return current;

  for (const legacyKey of LEGACY_KEYS) {
    const legacy = readKey(legacyKey);
    if (legacy) return legacy;
  }
  return null;
}

function asPersistedV6(db: HabitDb): PersistedDbV6 {
  return { version: 6, ...db };
}

export function exportDbSnapshot(db: HabitDb): string {
  return JSON.stringify(asPersistedV6(db), null, 2);
}

export function parseImportSnapshot(snapshotJson: string): HabitDb {
  let parsed: unknown;
  try {
    parsed = JSON.parse(snapshotJson);
  } catch {
    throw new Error("Invalid JSON file.");
  }
  return migrateDb(parsed);
}

let memory: HabitDb | null = null;
const listeners = new Set<() => void>();
const SERVER_SNAPSHOT = defaultDb();

function loadMemory(): HabitDb {
  if (memory) return memory;
  if (typeof window === "undefined") return SERVER_SNAPSHOT;

  const raw = loadPersistedRaw();
  memory = raw ? migrateDb(raw) : defaultDb();
  // Reset monthly freeze balance if needed
  const ym = currentYearMonth();
  if (memory.profile.freezeMonth !== ym) {
    memory = {
      ...memory,
      profile: { ...memory.profile, freezeMonth: ym, freezeBalance: FREEZES_PER_MONTH },
    };
  }
  writeStorage(memory);
  if (!readSyncMeta() && hasUserData(memory)) {
    writeSyncMeta(new Date().toISOString());
  }
  return memory;
}

function writeStorage(db: HabitDb) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, exportDbSnapshot(db));
  for (const legacyKey of LEGACY_KEYS) localStorage.removeItem(legacyKey);
}

type SyncMeta = { lastModifiedAt: string };

function readSyncMeta(): SyncMeta | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(SYNC_META_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as SyncMeta;
    return typeof parsed.lastModifiedAt === "string" ? parsed : null;
  } catch {
    return null;
  }
}

function writeSyncMeta(lastModifiedAt: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SYNC_META_KEY, JSON.stringify({ lastModifiedAt }));
}

function touchSyncMeta() {
  writeSyncMeta(new Date().toISOString());
}

export function getLocalLastModifiedAt(): string | null {
  return readSyncMeta()?.lastModifiedAt ?? null;
}

/** True when the user has meaningful data worth backing up. */
export function hasUserData(db: HabitDb): boolean {
  if (db.habits.length > 0) return true;
  if (Object.values(db.checkins).some((dates) => dates.length > 0)) return true;
  if (Object.keys(db.wellness).length > 0) return true;
  if (Object.keys(db.journal).length > 0) return true;
  if (db.profile.onboardingCompleted) return true;
  return false;
}

/** Replace local state from a cloud snapshot without bumping the modified timestamp. */
export function applyCloudSnapshot(snapshot: unknown, cloudUpdatedAt: string) {
  const next = migrateDb(snapshot);
  memory = next;
  writeStorage(next);
  writeSyncMeta(cloudUpdatedAt);
  listeners.forEach((l) => l());
}

/** Read the current in-memory db (client only). Used by cloud sync. */
export function getLocalDb(): HabitDb {
  return loadMemory();
}

function commit(next: HabitDb) {
  memory = next;
  writeStorage(next);
  touchSyncMeta();
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useDb(): HabitDb {
  return useSyncExternalStore(
    subscribe,
    () => loadMemory(),
    () => SERVER_SNAPSHOT,
  );
}

/* --- mutations: every change produces a NEW reference --- */

export function addHabit(
  h: Pick<Habit, "name" | "icon" | "color"> &
    Partial<
      Pick<Habit, "reminderTime" | "identity" | "frequency" | "stackAfterId" | "defaultTimerMin">
    >,
): Habit {
  const db = loadMemory();
  const habit: Habit = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    name: h.name,
    icon: h.icon,
    color: h.color,
    reminderTime: h.reminderTime,
    identity: h.identity,
    frequency: h.frequency ?? "daily",
    stackAfterId: h.stackAfterId,
    defaultTimerMin: h.defaultTimerMin,
  };
  commit({
    ...db,
    habits: [...db.habits, habit],
    checkins: { ...db.checkins, [habit.id]: [] },
    checkinMeta: { ...db.checkinMeta, [habit.id]: {} },
    freezesUsed: { ...db.freezesUsed, [habit.id]: [] },
  });
  return habit;
}

export function updateHabit(id: string, patch: Partial<Habit>) {
  const db = loadMemory();
  const idx = db.habits.findIndex((x) => x.id === id);
  if (idx < 0) return;
  const next = { ...db.habits[idx], ...patch };
  const habits = db.habits.slice();
  habits[idx] = sanitizeHabit(next as unknown as Record<string, unknown>);
  commit({ ...db, habits });
}

export function deleteHabit(id: string) {
  const db = loadMemory();
  const habits = db.habits
    .filter((h) => h.id !== id)
    .map((h) => (h.stackAfterId === id ? { ...h, stackAfterId: undefined } : h));
  const checkins = { ...db.checkins };
  delete checkins[id];
  const checkinMeta = { ...db.checkinMeta };
  delete checkinMeta[id];
  const freezesUsed = { ...db.freezesUsed };
  delete freezesUsed[id];
  commit({ ...db, habits, checkins, checkinMeta, freezesUsed });
}

export function toggleCheckin(habitId: string, date = new Date()) {
  const db = loadMemory();
  const key = ymd(date);
  const list = db.checkins[habitId] ?? [];
  const has = list.includes(key);
  const nextList = has ? list.filter((d) => d !== key) : [...list, key];
  const habitMeta = { ...(db.checkinMeta[habitId] ?? {}) };
  if (has) {
    delete habitMeta[key];
  } else {
    habitMeta[key] = {
      ...(habitMeta[key] ?? {}),
      loggedAt: new Date().toISOString(),
    };
  }
  commit({
    ...db,
    checkins: { ...db.checkins, [habitId]: nextList },
    checkinMeta: { ...db.checkinMeta, [habitId]: habitMeta },
  });
}

export function setCheckinNote(habitId: string, date: Date, note: string) {
  const db = loadMemory();
  const key = ymd(date);
  const habitMeta = { ...(db.checkinMeta[habitId] ?? {}) };
  const trimmed = note.trim().slice(0, 500);
  habitMeta[key] = {
    ...(habitMeta[key] ?? {}),
    note: trimmed || undefined,
  };
  if (!habitMeta[key].note && !habitMeta[key].loggedAt) {
    delete habitMeta[key];
  }
  commit({
    ...db,
    checkinMeta: { ...db.checkinMeta, [habitId]: habitMeta },
  });
}

export function logWellness(date: Date, patch: Partial<WellnessLog>) {
  const db = loadMemory();
  const key = ymd(date);
  const existing = db.wellness[key] ?? { date: key };
  commit({
    ...db,
    wellness: { ...db.wellness, [key]: { ...existing, ...patch, date: key } },
  });
}

export function setJournalEntry(date: Date, text: string, tags: string[] = []) {
  const db = loadMemory();
  const key = ymd(date);
  const cleaned = text.trim();
  const journal = { ...db.journal };
  if (!cleaned) {
    delete journal[key];
  } else {
    journal[key] = {
      date: key,
      text: cleaned.slice(0, 5000),
      tags: tags.filter((t) => t.trim()).slice(0, 8),
      updatedAt: new Date().toISOString(),
    };
  }
  commit({ ...db, journal });
}

export function deleteJournalEntry(date: Date) {
  const db = loadMemory();
  const key = ymd(date);
  if (!db.journal[key]) return;
  const journal = { ...db.journal };
  delete journal[key];
  commit({ ...db, journal });
}

export function updateProfile(patch: Partial<UserProfile>) {
  const db = loadMemory();
  const profile = sanitizeProfile({ ...db.profile, ...patch });
  commit({ ...db, profile });
}

export function startFreeTrial() {
  const db = loadMemory();
  if (db.profile.trialStartedAt) return;
  commit({
    ...db,
    profile: { ...db.profile, trialStartedAt: new Date().toISOString() },
  });
}

export function setVacation(active: boolean) {
  const db = loadMemory();
  commit({
    ...db,
    profile: {
      ...db.profile,
      vacationActive: active,
      vacationStartedAt: active ? new Date().toISOString() : null,
    },
  });
}

export function useFreeze(habitId: string, date = new Date()): boolean {
  const db = loadMemory();
  if (db.profile.freezeBalance <= 0) return false;
  const key = ymd(date);
  const list = db.freezesUsed[habitId] ?? [];
  if (list.includes(key)) return true;
  commit({
    ...db,
    freezesUsed: { ...db.freezesUsed, [habitId]: [...list, key].sort() },
    profile: { ...db.profile, freezeBalance: db.profile.freezeBalance - 1 },
  });
  return true;
}

export function clearFreeze(habitId: string, date: Date) {
  const db = loadMemory();
  const key = ymd(date);
  const list = db.freezesUsed[habitId] ?? [];
  if (!list.includes(key)) return;
  commit({
    ...db,
    freezesUsed: { ...db.freezesUsed, [habitId]: list.filter((d) => d !== key) },
    profile: {
      ...db.profile,
      freezeBalance: Math.min(FREEZES_PER_MONTH, db.profile.freezeBalance + 1),
    },
  });
}

/**
 * The most recent past due day (excluding today) that broke the streak and
 * could be rescued with a freeze, or null when there's nothing to protect.
 * Used to surface a "save your streak" action on each habit.
 */
export function recoverableFreezeDate(
  db: HabitDb,
  habitId: string,
  today = new Date(),
): string | null {
  if (db.profile.vacationActive) return null;
  const habit = db.habits.find((h) => h.id === habitId);
  if (!habit) return null;
  const set = new Set(db.checkins[habitId] ?? []);
  const frozen = new Set(db.freezesUsed[habitId] ?? []);
  for (let i = 1; i <= 7; i++) {
    const d = addDays(today, -i);
    if (!isHabitDueToday(habit, d)) continue;
    const key = ymd(d);
    if (set.has(key)) return null; // most recent due day was completed — no gap
    if (frozen.has(key)) return null; // already protected
    return key; // most recent missed due day — this is the gap to freeze
  }
  return null;
}

export function importDbSnapshot(snapshotJson: string) {
  commit(parseImportSnapshot(snapshotJson));
}

export function resetDb() {
  commit(defaultDb());
}

/* --- premium helpers --- */

export function isPremium(db: HabitDb, days = 7) {
  if (db.profile.plan !== "free") return true;
  if (db.profile.cloudPremium) return true;
  return trialDaysLeft(db, days) > 0;
}

export function trialDaysLeft(db: HabitDb, days = 7) {
  if (!db.profile.trialStartedAt) return 0;
  const started = new Date(db.profile.trialStartedAt).getTime();
  const elapsedDays = Math.floor((Date.now() - started) / 86400000);
  return Math.max(0, days - elapsedDays);
}

const PREMIUM_PROMPT_INTERVAL_MS = 7 * 86400 * 1000;

/** Returns true if we should pop the weekly upgrade modal. */
export function shouldShowWeeklyPremiumPrompt(db: HabitDb): boolean {
  if (!db.profile.onboardingCompleted) return false;
  if (db.profile.plan !== "free") return false;
  const last = db.profile.lastPremiumPromptAt;
  if (!last) return true;
  const ts = new Date(last).getTime();
  if (isNaN(ts)) return true;
  return Date.now() - ts >= PREMIUM_PROMPT_INTERVAL_MS;
}

/** Records that the upgrade modal was just shown so it won't show again for 7 days. */
export function markPremiumPromptShown() {
  const db = loadMemory();
  commit({
    ...db,
    profile: { ...db.profile, lastPremiumPromptAt: new Date().toISOString() },
  });
}

/** Updates the user's theme preference. */
export function setTheme(theme: ThemePreference) {
  updateProfile({ theme });
}

export function greetingFor(name: string, at = new Date()) {
  const hour = at.getHours();
  const safeName = name.trim() || "there";
  if (hour < 12) return `Good morning, ${safeName}`;
  if (hour < 17) return `Good afternoon, ${safeName}`;
  return `Good evening, ${safeName}`;
}

/* --- date helpers --- */

export function ymd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function isHabitDueToday(habit: Habit, date = new Date()) {
  const day = date.getDay();
  const isWeekend = day === 0 || day === 6;
  if (habit.frequency === "weekdays") return !isWeekend;
  if (habit.frequency === "weekends") return isWeekend;
  return true;
}

/* --- selectors --- */

export function isCheckedToday(db: HabitDb, habitId: string, date = new Date()) {
  return db.checkins[habitId]?.includes(ymd(date)) ?? false;
}

function isDateProtected(db: HabitDb, habitId: string, dateKey: string): boolean {
  if (db.profile.vacationActive) return true;
  return db.freezesUsed[habitId]?.includes(dateKey) ?? false;
}

export function streakFor(db: HabitDb, habitId: string, today = new Date()): number {
  const set = new Set(db.checkins[habitId] ?? []);
  const habit = db.habits.find((h) => h.id === habitId);
  let streak = 0;
  let cursor = new Date(today);

  // Skip today if not yet checked
  if (!set.has(ymd(cursor))) cursor = addDays(cursor, -1);

  while (true) {
    const key = ymd(cursor);
    if (set.has(key)) {
      streak++;
      cursor = addDays(cursor, -1);
      continue;
    }
    if (habit && !isHabitDueToday(habit, cursor)) {
      cursor = addDays(cursor, -1);
      continue;
    }
    if (isDateProtected(db, habitId, key)) {
      cursor = addDays(cursor, -1);
      continue;
    }
    break;
  }
  return streak;
}

export function bestStreakFor(db: HabitDb, habitId: string): number {
  const dates = (db.checkins[habitId] ?? []).slice().sort();
  if (!dates.length) return 0;
  let best = 1;
  let cur = 1;
  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(dates[i - 1]);
    const next = new Date(dates[i]);
    const diff = Math.round((next.getTime() - prev.getTime()) / 86400000);
    if (diff === 1) cur++;
    else cur = 1;
    if (cur > best) best = cur;
  }
  return best;
}

export function completionRate(db: HabitDb, days = 7, today = new Date()): number {
  if (!db.habits.length) return 0;
  let done = 0;
  let total = 0;
  for (let i = 0; i < days; i++) {
    const d = addDays(today, -i);
    const key = ymd(d);
    for (const h of db.habits) {
      if (!isHabitDueToday(h, d)) continue;
      total++;
      if (db.checkins[h.id]?.includes(key)) done++;
    }
  }
  return total ? Math.round((done / total) * 100) : 0;
}

export function weeklyCompletion(db: HabitDb, today = new Date()) {
  const out: { day: string; pct: number }[] = [];
  const labels = ["S", "M", "T", "W", "T", "F", "S"];
  for (let i = 6; i >= 0; i--) {
    const d = addDays(today, -i);
    const key = ymd(d);
    const dueHabits = db.habits.filter((h) => isHabitDueToday(h, d));
    const total = dueHabits.length || 1;
    const done = dueHabits.filter((h) => db.checkins[h.id]?.includes(key)).length;
    out.push({ day: labels[d.getDay()], pct: Math.round((done / total) * 100) });
  }
  return out;
}

export function gridLevels(db: HabitDb, habitId: string, weeks = 14, today = new Date()): number[] {
  const set = new Set(db.checkins[habitId] ?? []);
  const cells: number[] = [];
  const total = weeks * 7;
  for (let i = total - 1; i >= 0; i--) {
    const d = addDays(today, -i);
    cells.push(set.has(ymd(d)) ? 4 : 0);
  }
  return cells;
}

/* --- yearly grid (Grovv "growth grid") --- */

export type YearCell = { date: string; pct: number; checks: number; total: number };

export function yearGrid(db: HabitDb, today = new Date()): YearCell[] {
  const cells: YearCell[] = [];
  for (let i = 364; i >= 0; i--) {
    const d = addDays(today, -i);
    const key = ymd(d);
    const due = db.habits.filter((h) => isHabitDueToday(h, d));
    const checks = due.filter((h) => db.checkins[h.id]?.includes(key)).length;
    const total = due.length;
    cells.push({
      date: key,
      checks,
      total,
      pct: total ? Math.round((checks / total) * 100) : 0,
    });
  }
  return cells;
}

/* --- Weekly review --- */

export type WeeklyReview = {
  bestHabit: { habit: Habit; rate: number } | null;
  worstDay: { date: string; pct: number } | null;
  suggestedTweak: string;
  totalCheckins: number;
  pct: number;
};

export function weeklyReview(db: HabitDb, today = new Date()): WeeklyReview {
  // Look at last 7 days
  const days: { date: string; pct: number }[] = [];
  let totalCheckins = 0;
  for (let i = 0; i < 7; i++) {
    const d = addDays(today, -i);
    const key = ymd(d);
    const due = db.habits.filter((h) => isHabitDueToday(h, d));
    const checks = due.filter((h) => db.checkins[h.id]?.includes(key)).length;
    totalCheckins += checks;
    days.push({ date: key, pct: due.length ? Math.round((checks / due.length) * 100) : 0 });
  }
  const worstDay = days.reduce<{ date: string; pct: number } | null>(
    (acc, d) => (acc === null || d.pct < acc.pct ? d : acc),
    null,
  );

  let bestHabit: { habit: Habit; rate: number } | null = null;
  for (const h of db.habits) {
    let due = 0;
    let done = 0;
    for (let i = 0; i < 7; i++) {
      const d = addDays(today, -i);
      if (!isHabitDueToday(h, d)) continue;
      due++;
      if (db.checkins[h.id]?.includes(ymd(d))) done++;
    }
    if (!due) continue;
    const rate = Math.round((done / due) * 100);
    if (!bestHabit || rate > bestHabit.rate) bestHabit = { habit: h, rate };
  }

  const totalPct = Math.round(days.reduce((a, b) => a + b.pct, 0) / Math.max(1, days.length));

  // Tweak suggestion: check worst habit and worst day
  let suggestedTweak = "Keep showing up — your average held steady this week.";
  if (totalPct === 0 || db.habits.length === 0) {
    suggestedTweak = "Plant your first habit and check it off today.";
  } else if (worstDay && worstDay.pct < 40) {
    const dayLabel = new Date(worstDay.date).toLocaleDateString(undefined, { weekday: "long" });
    suggestedTweak = `${dayLabel}s are your hardest day — try moving one habit earlier.`;
  } else if (bestHabit && bestHabit.rate >= 80) {
    suggestedTweak = `You're crushing "${bestHabit.habit.name}". Try stacking a tiny habit right after it.`;
  } else if (totalPct < 50) {
    suggestedTweak = "Drop down to 1–2 anchor habits this week to rebuild momentum.";
  }

  return { bestHabit, worstDay, suggestedTweak, totalCheckins, pct: totalPct };
}

/* --- mood ↔ habit correlation --- */

export type MoodCorrelation = {
  habit: Habit;
  moodWith: number;
  moodWithout: number;
  delta: number; // positive => mood is higher on days with the habit
  samplesWith: number;
  samplesWithout: number;
};

export function moodHabitCorrelations(db: HabitDb): MoodCorrelation[] {
  const moodDates = Object.values(db.wellness).filter((w) => typeof w.mood === "number");
  if (moodDates.length < 5 || db.habits.length === 0) return [];
  const out: MoodCorrelation[] = [];
  for (const habit of db.habits) {
    const checkSet = new Set(db.checkins[habit.id] ?? []);
    const withMood: number[] = [];
    const withoutMood: number[] = [];
    for (const w of moodDates) {
      if (typeof w.mood !== "number") continue;
      if (checkSet.has(w.date)) withMood.push(w.mood);
      else withoutMood.push(w.mood);
    }
    if (withMood.length < 2 || withoutMood.length < 2) continue;
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    const a = avg(withMood);
    const b = avg(withoutMood);
    out.push({
      habit,
      moodWith: Math.round(a * 100) / 100,
      moodWithout: Math.round(b * 100) / 100,
      delta: Math.round(((a - b) / Math.max(0.5, b)) * 100),
      samplesWith: withMood.length,
      samplesWithout: withoutMood.length,
    });
  }
  return out.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

/* --- adaptive reminders: median check-in HH:MM for a habit --- */

export function adaptiveReminderTimeFor(db: HabitDb, habitId: string): string | null {
  const meta = db.checkinMeta[habitId];
  if (!meta) return null;
  const minutes: number[] = [];
  for (const m of Object.values(meta)) {
    if (!m.loggedAt) continue;
    const d = new Date(m.loggedAt);
    if (isNaN(d.getTime())) continue;
    minutes.push(d.getHours() * 60 + d.getMinutes());
  }
  if (minutes.length < 5) return null;
  minutes.sort((a, b) => a - b);
  const median = minutes[Math.floor(minutes.length / 2)];
  const hh = String(Math.floor(median / 60)).padStart(2, "0");
  const mm = String(median % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

/* --- SSR-safe mounted hook --- */

export function useMounted() {
  const [m, setM] = useState(false);
  useEffect(() => setM(true), []);
  return m;
}
