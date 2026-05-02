import { useEffect, useRef } from "react";
import { adaptiveReminderTimeFor, ymd, type HabitDb } from "@/lib/habits";

const QUOTES = [
  "Small steps still move you forward.",
  "Consistency beats intensity.",
  "Show up for yourself today.",
  "Growth happens one check-in at a time.",
  "You don't need motivation, you need a system.",
  "Discipline is freedom.",
];

function quote() {
  return QUOTES[Math.floor(Math.random() * QUOTES.length)];
}

function hhmm(now: Date) {
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

export async function requestNotificationPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported" as const;
  if (Notification.permission === "granted") return "granted" as const;
  if (Notification.permission === "denied") return "denied" as const;
  return Notification.requestPermission();
}

export function useReminderEngine(db: HabitDb) {
  const lastSentRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!db.profile.remindersEnabled) return;
    if (!("Notification" in window)) return;

    const tick = () => {
      if (Notification.permission !== "granted") return;
      const now = new Date();
      const current = hhmm(now);
      const todayKey = ymd(now);

      for (const habit of db.habits) {
        const targetTime = db.profile.adaptiveReminders
          ? (adaptiveReminderTimeFor(db, habit.id) ?? habit.reminderTime)
          : habit.reminderTime;
        if (!targetTime || targetTime !== current) continue;
        if (db.checkins[habit.id]?.includes(todayKey)) continue;

        const dedupe = `${todayKey}:${habit.id}:${current}`;
        if (lastSentRef.current.has(dedupe)) continue;

        new Notification(`Time for ${habit.name}`, {
          body: habit.identity ? `${habit.identity}. ${quote()}` : quote(),
          tag: dedupe,
        });
        lastSentRef.current.add(dedupe);
      }
    };

    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, [db]);
}
