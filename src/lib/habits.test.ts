import { describe, expect, it } from "vitest";
import {
  completionRate,
  defaultProfile,
  isHabitDueToday,
  migrateDb,
  streakFor,
  weeklyCompletion,
  type HabitDb,
} from "@/lib/habits";

const baseDb: HabitDb = {
  habits: [
    {
      id: "h1",
      name: "Run",
      icon: "🏃",
      color: "green",
      createdAt: "2026-05-01T00:00:00.000Z",
      frequency: "daily",
    },
    {
      id: "h2",
      name: "Read",
      icon: "📖",
      color: "purple",
      createdAt: "2026-05-01T00:00:00.000Z",
      frequency: "daily",
    },
  ],
  checkins: {
    h1: ["2026-05-01", "2026-04-30", "2026-04-29"],
    h2: ["2026-04-30"],
  },
  checkinMeta: { h1: {}, h2: {} },
  wellness: {},
  journal: {},
  freezesUsed: { h1: [], h2: [] },
  profile: defaultProfile(),
};

describe("habit selectors", () => {
  it("computes streak from today when checked in", () => {
    const today = new Date("2026-05-01T12:00:00.000Z");
    expect(streakFor(baseDb, "h1", today)).toBe(3);
  });

  it("computes completion rate over a date window", () => {
    const today = new Date("2026-05-01T12:00:00.000Z");
    expect(completionRate(baseDb, 2, today)).toBe(75);
  });

  it("returns 7 weekly data points", () => {
    const today = new Date("2026-05-01T12:00:00.000Z");
    const week = weeklyCompletion(baseDb, today);
    expect(week).toHaveLength(7);
    expect(week.at(-1)?.pct).toBe(50);
  });
});

describe("frequency", () => {
  it("only counts weekday-only habits on weekdays", () => {
    const friday = new Date("2026-05-01T12:00:00.000Z");
    const saturday = new Date("2026-05-02T12:00:00.000Z");
    const habit = { ...baseDb.habits[0], frequency: "weekdays" as const };
    expect(isHabitDueToday(habit, friday)).toBe(true);
    expect(isHabitDueToday(habit, saturday)).toBe(false);
  });
});

describe("db migration", () => {
  it("migrates legacy payloads and sanitizes invalid fields", () => {
    const legacy = {
      habits: [
        {
          id: "h1",
          name: "Run",
          icon: "🏃",
          color: "green",
          createdAt: "2026-05-01T00:00:00.000Z",
        },
        { id: "h2", name: "", icon: "", color: "bad-color", createdAt: "" },
      ],
      checkins: {
        h1: ["2026-05-01", "bad-date", "2026-05-01"],
        h2: ["2026-05-02"],
      },
      wellness: {
        "2026-05-01": { date: "2026-05-01", mood: 7, sleepHours: 8 },
      },
    };

    const migrated = migrateDb(legacy);
    expect(migrated.habits).toHaveLength(2);
    expect(migrated.habits[1].name).toBe("Untitled habit");
    expect(migrated.habits[1].color).toBe("purple");
    expect(migrated.habits[0].frequency).toBe("daily");
    expect(migrated.checkins.h1).toEqual(["2026-05-01"]);
    expect(migrated.wellness["2026-05-01"].mood).toBeUndefined();
    expect(migrated.wellness["2026-05-01"].sleepHours).toBe(8);
  });
});
