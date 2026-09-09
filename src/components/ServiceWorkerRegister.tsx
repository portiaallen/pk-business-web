"use client";

import { useEffect } from "react";

/** Registers the PWA service worker (client-side only, once). */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return; // avoid dev-cache confusion

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* non-fatal — PWA features simply unavailable */
      });
    };

    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });

    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
