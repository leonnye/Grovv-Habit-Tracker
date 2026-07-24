import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
let registered = false;

function emit() {
  for (const l of listeners) l();
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const mq = window.matchMedia?.("(display-mode: standalone)")?.matches;
  const ios = "standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  return Boolean(mq || ios);
}

/** Register the installable service worker once on the client. */
export function registerPwa() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;
  if (registered) return;
  registered = true;

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    emit();
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    emit();
  });

  void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
    /* optional — install may still work via browser menu on some platforms */
  });
}

export async function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  if (!deferredPrompt) return "unavailable";
  const prompt = deferredPrompt;
  deferredPrompt = null;
  emit();
  await prompt.prompt();
  const choice = await prompt.userChoice;
  return choice.outcome;
}

export function usePwaInstall() {
  const [canInstall, setCanInstall] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const sync = () => {
      setInstalled(isStandalone());
      setCanInstall(Boolean(deferredPrompt) && !isStandalone());
    };
    sync();
    listeners.add(sync);
    return () => {
      listeners.delete(sync);
    };
  }, []);

  return {
    canInstall,
    installed,
    isIos:
      typeof navigator !== "undefined" &&
      /iphone|ipad|ipod/i.test(navigator.userAgent) &&
      !isStandalone(),
    install: promptInstall,
  };
}
