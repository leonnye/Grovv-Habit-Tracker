import type { HabitDb } from "@/lib/habits";

function escape(value: string | number | undefined | null) {
  if (value === undefined || value === null) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function row(values: Array<string | number | undefined | null>) {
  return values.map(escape).join(",");
}

export function dbToCsv(db: HabitDb): string {
  const lines: string[] = [];
  lines.push("# Grovv export");
  lines.push("");

  lines.push("## Habits");
  lines.push(
    row([
      "id",
      "name",
      "icon",
      "color",
      "frequency",
      "reminderTime",
      "identity",
      "stackAfterId",
      "defaultTimerMin",
      "createdAt",
    ]),
  );
  for (const h of db.habits) {
    lines.push(
      row([
        h.id,
        h.name,
        h.icon,
        h.color,
        h.frequency,
        h.reminderTime ?? "",
        h.identity ?? "",
        h.stackAfterId ?? "",
        h.defaultTimerMin ?? "",
        h.createdAt,
      ]),
    );
  }

  lines.push("");
  lines.push("## Checkins");
  lines.push(row(["habitId", "date", "note"]));
  for (const [habitId, dates] of Object.entries(db.checkins)) {
    for (const date of dates) {
      const note = db.checkinMeta[habitId]?.[date]?.note ?? "";
      lines.push(row([habitId, date, note]));
    }
  }

  lines.push("");
  lines.push("## Wellness");
  lines.push(row(["date", "mood", "sleepHours", "waterLiters", "note"]));
  for (const w of Object.values(db.wellness)) {
    lines.push(row([w.date, w.mood ?? "", w.sleepHours ?? "", w.waterLiters ?? "", w.note ?? ""]));
  }

  lines.push("");
  lines.push("## Journal");
  lines.push(row(["date", "tags", "text"]));
  for (const j of Object.values(db.journal)) {
    lines.push(row([j.date, j.tags.join("|"), j.text]));
  }

  return lines.join("\n");
}
