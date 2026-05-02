import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  habitColor,
  isCheckedToday,
  logWellness,
  toggleCheckin,
  useDb,
  type Habit,
} from "@/lib/habits";

type Action = {
  id: string;
  label: string;
  hint?: string;
  icon: string;
  keywords?: string[];
  group: "Navigate" | "Habits" | "Mood" | "Tools";
  run: () => void;
};

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const db = useDb();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActiveIdx(0);
    const id = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(id);
  }, [open]);

  const actions = useMemo<Action[]>(() => {
    const navItems = [
      { id: "go-home", label: "Go to Today", icon: "✦", path: "/" },
      { id: "go-habits", label: "Manage habits", icon: "◎", path: "/habits" },
      { id: "go-analytics", label: "Open analytics", icon: "▢", path: "/analytics" },
      { id: "go-wellness", label: "Open wellness", icon: "♡", path: "/wellness" },
      { id: "go-timer", label: "Open focus timer", icon: "⏱", path: "/timer" },
      { id: "go-settings", label: "Open settings", icon: "⚙", path: "/settings" },
      { id: "go-pricing", label: "Grovv Pro", icon: "💎", path: "/pricing" },
    ];
    const navActions: Action[] = navItems.map((n) => ({
      id: n.id,
      label: n.label,
      icon: n.icon,
      group: "Navigate",
      run: () => {
        void navigate({ to: n.path });
        onClose();
      },
    }));

    const habitActions: Action[] = db.habits.map((h: Habit) => {
      const done = isCheckedToday(db, h.id);
      return {
        id: `habit-${h.id}`,
        label: `${done ? "Uncheck" : "Check off"} ${h.name}`,
        icon: h.icon,
        group: "Habits",
        keywords: [h.name, h.identity ?? ""],
        run: () => {
          toggleCheckin(h.id);
          onClose();
        },
      };
    });

    const moodActions: Action[] = [1, 2, 3, 4, 5].map((m) => ({
      id: `mood-${m}`,
      label: `Log mood ${m}/5`,
      hint: ["very low", "low", "neutral", "good", "great"][m - 1],
      icon: ["😞", "😕", "😐", "🙂", "😄"][m - 1],
      group: "Mood",
      run: () => {
        logWellness(new Date(), { mood: m as 1 | 2 | 3 | 4 | 5 });
        onClose();
      },
    }));

    const tools: Action[] = [
      {
        id: "start-pomodoro",
        label: "Start Pomodoro (25m)",
        icon: "⏱",
        group: "Tools",
        run: () => {
          if (typeof window !== "undefined") {
            sessionStorage.setItem("grovv.timer.preset", String(25 * 60));
          }
          void navigate({ to: "/timer" });
          onClose();
        },
      },
      {
        id: "start-deep",
        label: "Start deep work (90m)",
        icon: "⏱",
        group: "Tools",
        run: () => {
          if (typeof window !== "undefined") {
            sessionStorage.setItem("grovv.timer.preset", String(90 * 60));
          }
          void navigate({ to: "/timer" });
          onClose();
        },
      },
    ];

    return [...habitActions, ...moodActions, ...navActions, ...tools];
  }, [db, navigate, onClose]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return actions;
    return actions.filter((a) => {
      const haystack = `${a.label} ${a.hint ?? ""} ${(a.keywords ?? []).join(" ")}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [actions, query]);

  // Group ordering
  const groups = useMemo(() => {
    const order: Action["group"][] = ["Habits", "Mood", "Navigate", "Tools"];
    const map = new Map<Action["group"], Action[]>();
    for (const a of filtered) {
      const list = map.get(a.group) ?? [];
      list.push(a);
      map.set(a.group, list);
    }
    return order
      .map((g) => ({ group: g, items: map.get(g) ?? [] }))
      .filter((g) => g.items.length > 0);
  }, [filtered]);

  // Flat list for keyboard nav
  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  useEffect(() => {
    setActiveIdx(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIdx((i) => Math.min(flat.length - 1, i + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx((i) => Math.max(0, i - 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const a = flat[activeIdx];
        if (a) a.run();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, flat, activeIdx]);

  if (!open) return null;

  let runningIdx = -1;

  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-start justify-center bg-background/60 backdrop-blur-sm p-4 pt-[12vh]"
      onClick={onClose}
      role="presentation"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Quick actions"
        className="w-full max-w-xl rounded-2xl border border-border bg-[var(--surface)] shadow-[0_30px_80px_rgba(0,0,0,0.2)] grovv-slide-down overflow-hidden"
      >
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <span className="text-muted-foreground">⌘</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command — log a habit, change page, log mood…"
            className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-muted-foreground"
          />
          <kbd className="hidden sm:inline rounded bg-[var(--surface-2)] px-1.5 py-0.5 font-mono text-[0.65rem] border border-border text-muted-foreground">
            esc
          </kbd>
        </div>
        <div className="max-h-[60vh] overflow-y-auto py-2">
          {groups.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              No matches. Try a different word.
            </p>
          )}
          {groups.map((g) => (
            <div key={g.group} className="px-1">
              <div className="px-3 py-1.5 text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground font-semibold">
                {g.group}
              </div>
              {g.items.map((a) => {
                runningIdx++;
                const active = runningIdx === activeIdx;
                const habit = a.id.startsWith("habit-")
                  ? db.habits.find((h) => `habit-${h.id}` === a.id)
                  : null;
                return (
                  <button
                    key={a.id}
                    type="button"
                    onMouseEnter={() => setActiveIdx(runningIdx)}
                    onClick={a.run}
                    className={
                      "w-full flex items-center gap-3 px-3 py-2.5 text-left rounded-lg transition-colors " +
                      (active ? "bg-[var(--surface-2)]" : "hover:bg-[var(--surface-2)]/60")
                    }
                  >
                    <span
                      className="size-8 rounded-lg grid place-items-center text-base shrink-0"
                      style={
                        habit
                          ? {
                              background: `color-mix(in oklab, ${habitColor(habit.color)} 15%, transparent)`,
                            }
                          : { background: "var(--surface-2)" }
                      }
                    >
                      {a.icon}
                    </span>
                    <span className="flex-1 text-sm">{a.label}</span>
                    {a.hint && (
                      <span className="text-[0.65rem] text-muted-foreground">{a.hint}</span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <div className="border-t border-border px-4 py-2 flex items-center justify-between text-[0.65rem] text-muted-foreground">
          <span>↑↓ navigate · ↵ run · esc close</span>
          <span>{flat.length} actions</span>
        </div>
      </div>
    </div>
  );
}
