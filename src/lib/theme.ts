import { useEffect } from "react";
import { setTheme, type ThemePreference } from "@/lib/habits";

/** Resolves a stored ThemePreference to a concrete "light" | "dark" using system preference. */
export function resolveTheme(pref: ThemePreference): "light" | "dark" {
  if (pref === "light" || pref === "dark") return pref;
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Applies the theme to <html> by toggling the .dark class and updating browser chrome. */
export function applyTheme(pref: ThemePreference) {
  if (typeof document === "undefined") return;
  const resolved = resolveTheme(pref);
  document.documentElement.classList.toggle("dark", resolved === "dark");

  // Keep the mobile address-bar / status-bar color in sync with the user's choice.
  const color = resolved === "dark" ? "#0c100e" : "#f5f2eb";
  const metas = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');
  if (metas.length === 0) {
    const meta = document.createElement("meta");
    meta.setAttribute("name", "theme-color");
    meta.setAttribute("content", color);
    document.head.appendChild(meta);
  } else {
    metas.forEach((m) => m.setAttribute("content", color));
  }
}

/** Hook that syncs the document with the current theme preference and reacts to system changes. */
export function useThemeSync(pref: ThemePreference) {
  useEffect(() => {
    applyTheme(pref);
    if (pref !== "system" || typeof window === "undefined") return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme("system");
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [pref]);
}

/** Cycles between light and dark (skipping "system" once the user manually toggles). */
export function toggleTheme(current: ThemePreference) {
  const resolved = resolveTheme(current);
  setTheme(resolved === "dark" ? "light" : "dark");
}
