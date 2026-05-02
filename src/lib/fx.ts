/**
 * Lightweight DOM-based "check-in" FX: a soft blue / light-blue ripple
 * with a confetti burst, anchored to the click position.
 * Singleton overlay is lazily created and reused.
 */

let overlay: HTMLDivElement | null = null;

function ensureOverlay(): HTMLDivElement | null {
  if (typeof document === "undefined") return null;
  if (overlay && overlay.isConnected) return overlay;
  overlay = document.createElement("div");
  overlay.className = "grovv-ripple-overlay";
  overlay.setAttribute("aria-hidden", "true");
  document.body.appendChild(overlay);
  return overlay;
}

export type FxOptions = {
  size?: number; // ripple final diameter px
  confetti?: number; // number of confetti dots
};

export function playCheckinFx(x: number, y: number, opts: FxOptions = {}) {
  const root = ensureOverlay();
  if (!root) return;

  const prefersReduced =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (prefersReduced) return;

  const size = opts.size ?? 600;
  const confettiCount = opts.confetti ?? 14;

  const ripple = document.createElement("span");
  ripple.className = "grovv-ripple";
  ripple.style.left = `${x}px`;
  ripple.style.top = `${y}px`;
  ripple.style.width = `${size}px`;
  ripple.style.height = `${size}px`;
  root.appendChild(ripple);
  window.setTimeout(() => ripple.remove(), 1100);

  const colors = ["#7ecbff", "#2f7be0", "#bde7ff", "#5aa6f0", "#a3d8ff"];
  for (let i = 0; i < confettiCount; i++) {
    const dot = document.createElement("span");
    dot.className = "grovv-confetti";
    dot.style.left = `${x}px`;
    dot.style.top = `${y}px`;
    const angle = Math.random() * Math.PI * 2;
    const distance = 60 + Math.random() * 80;
    const tx = Math.cos(angle) * distance;
    const ty = Math.sin(angle) * distance - 30;
    dot.style.background = colors[i % colors.length];
    dot.style.setProperty("--grovv-confetti-end", `translate(${tx}px, ${ty}px)`);
    root.appendChild(dot);
    window.setTimeout(() => dot.remove(), 1100);
  }
}
