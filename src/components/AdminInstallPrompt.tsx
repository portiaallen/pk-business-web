"use client";

import { useEffect, useState } from "react";
import { MonitorDown, X } from "lucide-react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISSED_KEY = "pk-pwa-install-dismissed";

/**
 * "Install app" entry for the admin sidebar. Appears only when the browser
 * supports PWA installation (beforeinstallprompt fired) and on standalone-capable
 * mobile browsers. Falls back to brief instructions on iOS Safari, which does
 * not fire beforeinstallprompt.
 */
export function AdminInstallButton({ variant = "sidebar" }: { variant?: "sidebar" | "banner" }) {
  const [deferredPrompt, setDeferredPrompt] = useState<InstallPromptEvent | null>(null);
  const [isIos, setIsIos] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [showIosHint, setShowIosHint] = useState(false);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISSED_KEY) === "1");
    setIsIos(
      /iphone|ipad|ipod/i.test(navigator.userAgent) &&
        !/crios|fxios|edgios/i.test(navigator.userAgent)
    );
    setInstalled(
      window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true
    );

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, "1");
    setDismissed(true);
  }

  async function install() {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      return;
    }
    if (isIos) setShowIosHint(true);
  }

  if (installed || dismissed) return null;
  if (!deferredPrompt && !isIos) return null;

  if (variant === "banner") {
    return (
      <div
        role="status"
        className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gold/40 bg-gold/10 p-4"
      >
        <div className="min-w-0">
          <p className="font-medium text-charcoal">Install PK Admin on this device</p>
          <p className="text-sm text-muted-gray">
            Add the portal to your home screen for full-screen, app-like access.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={install}
            className="inline-flex min-h-11 items-center gap-2 rounded-md bg-charcoal px-4 text-sm font-medium text-ivory hover:bg-charcoal/90"
          >
            <MonitorDown className="size-4" /> Install
          </button>
          <button
            onClick={dismiss}
            aria-label="Dismiss install prompt"
            className="inline-flex size-11 items-center justify-center rounded-md text-muted-gray hover:text-charcoal"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-2">
      <button
        onClick={install}
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-gray transition-colors hover:bg-secondary hover:text-charcoal"
      >
        <MonitorDown className="size-4" />
        Install App
      </button>
      {showIosHint && (
        <p className="mt-1 rounded-md bg-secondary p-3 text-xs leading-relaxed text-muted-gray">
          On iPhone/iPad: tap <strong>Share</strong>, then{" "}
          <strong>Add to Home Screen</strong>.
        </p>
      )}
    </div>
  );
}
