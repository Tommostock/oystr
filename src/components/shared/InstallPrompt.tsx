/**
 * InstallPrompt.tsx — PWA install prompt banner
 *
 * Shows a subtle banner prompting first-time users to install the app.
 * Uses the browser's beforeinstallprompt event to detect when the app
 * is installable, then shows the banner with a "INSTALL" button.
 *
 * The banner can be dismissed and won't show again for that session.
 * Styled like a dot-matrix notification bar.
 *
 * Usage:
 *   <InstallPrompt />
 *   (Place in layout.tsx — it handles its own visibility)
 */

"use client";

import { useState, useEffect, useRef } from "react";
import { Download, X } from "lucide-react";
import { cn } from "@/lib/utils";

/* Store the deferred prompt so we can trigger it later */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function InstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    /* Don't show if already installed (standalone mode) */
    if (window.matchMedia("(display-mode: standalone)").matches) {
      return;
    }

    /* Don't show if user dismissed it this session */
    if (sessionStorage.getItem("oystr-install-dismissed")) {
      return;
    }

    /**
     * Listen for the browser's install prompt event.
     * This fires when the browser detects the app meets PWA criteria.
     */
    const handler = (e: Event) => {
      e.preventDefault();
      deferredPrompt.current = e as BeforeInstallPromptEvent;
      /* Small delay so the page loads first */
      setTimeout(() => setShowPrompt(true), 3000);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  /**
   * Trigger the install prompt.
   */
  const handleInstall = async () => {
    if (!deferredPrompt.current) return;

    await deferredPrompt.current.prompt();
    const { outcome } = await deferredPrompt.current.userChoice;

    if (outcome === "accepted") {
      setShowPrompt(false);
    }

    deferredPrompt.current = null;
  };

  /**
   * Dismiss the banner for this session.
   */
  const handleDismiss = () => {
    setShowPrompt(false);
    sessionStorage.setItem("oystr-install-dismissed", "true");
  };

  if (!showPrompt) return null;

  return (
    <div
      className={cn(
        "w-full py-2 px-4",
        "bg-surface border-b border-board-border",
        "flex items-center justify-between gap-3"
      )}
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <Download size={14} strokeWidth={1.5} className="text-amber shrink-0" />
        <span className="font-mono text-xs tracking-wider text-amber-faint truncate">
          INSTALL OYSTR FOR QUICK ACCESS
        </span>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={handleInstall}
          className={cn(
            "px-3 py-1",
            "border border-amber text-amber",
            "font-mono text-xs tracking-wider",
            "hover:bg-amber/10 transition-colors"
          )}
        >
          INSTALL
        </button>
        <button
          onClick={handleDismiss}
          className="p-1 text-amber-faint hover:text-amber transition-colors"
          aria-label="Dismiss install prompt"
        >
          <X size={14} strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}
