/**
 * OnboardingOverlay.tsx — First-time user onboarding
 *
 * A 3-step overlay that guides new users through the app:
 *   1. "Search for your station" — highlights the search bar
 *   2. "Save your favourites" — explains the save feature
 *   3. "Install for offline use" — prompts PWA installation
 *
 * Each step shows a spotlight on the relevant area of the screen
 * with a tooltip below it. Users tap "NEXT" to advance or "SKIP"
 * to dismiss. Only shows once (tracked in localStorage).
 *
 * Styled with the dot-matrix amber theme.
 */

"use client";

import { useState, useEffect } from "react";
import { ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";

/** Steps in the onboarding flow */
const ONBOARDING_STEPS = [
  {
    title: "SEARCH FOR YOUR STATION",
    description:
      "Type any station or bus stop name to see live departure times. Tap a result to view the full departure board.",
    position: "top" as const,
  },
  {
    title: "SAVE YOUR FAVOURITES",
    description:
      "Tap the star icon on any station to save it. Saved stations appear on the home screen for quick one-tap access.",
    position: "middle" as const,
  },
  {
    title: "EXPLORE NEARBY",
    description:
      "Use the Nearby tab to see all stations and bus stops on a live map around you. Tap any marker for arrivals.",
    position: "middle" as const,
  },
  {
    title: "INSTALL FOR OFFLINE",
    description:
      "Install Oystr to your home screen for instant access and offline timetables. Works just like a native app.",
    position: "bottom" as const,
  },
];

export default function OnboardingOverlay() {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    /* Only show onboarding once — check localStorage */
    if (localStorage.getItem("oystr-onboarding-done")) return;

    /* Delay to let the splash screen finish */
    const timer = setTimeout(() => setVisible(true), 2500);
    return () => clearTimeout(timer);
  }, []);

  /** Advance to next step or finish */
  const handleNext = () => {
    if (step < ONBOARDING_STEPS.length - 1) {
      setStep(step + 1);
    } else {
      handleDismiss();
    }
  };

  /** Dismiss the onboarding permanently */
  const handleDismiss = () => {
    setVisible(false);
    localStorage.setItem("oystr-onboarding-done", "true");
  };

  if (!visible) return null;

  const currentStep = ONBOARDING_STEPS[step];

  return (
    <div
      className="fixed inset-0 z-[8000] onboarding-overlay"
      style={{ background: "rgba(0, 0, 0, 0.85)" }}
      onClick={(e) => {
        /* Only dismiss if tapping the backdrop, not the card */
        if (e.target === e.currentTarget) handleNext();
      }}
    >
      {/* Centered tooltip card */}
      <div
        className={cn(
          "absolute left-4 right-4 max-w-sm mx-auto",
          currentStep.position === "top" && "top-24",
          currentStep.position === "middle" && "top-1/2 -translate-y-1/2",
          currentStep.position === "bottom" && "bottom-24"
        )}
      >
        <div className="bg-surface border border-amber/40 p-5 onboarding-highlight">
          {/* Step counter */}
          <div className="flex items-center justify-between mb-3">
            <span className="font-mono text-[10px] tracking-wider text-amber-faint uppercase">
              STEP {step + 1} OF {ONBOARDING_STEPS.length}
            </span>
            <button
              onClick={handleDismiss}
              className="p-1 text-amber-faint hover:text-amber transition-colors"
              aria-label="Skip onboarding"
            >
              <X size={14} strokeWidth={1.5} />
            </button>
          </div>

          {/* Step title */}
          <h2
            className="font-board text-xl tracking-wider text-amber uppercase mb-2"
            style={{
              textShadow: "0 0 10px rgba(255, 149, 0, 0.5)",
            }}
          >
            {currentStep.title}
          </h2>

          {/* Step description */}
          <p className="font-mono text-xs tracking-wider text-amber-dim leading-relaxed mb-4">
            {currentStep.description}
          </p>

          {/* Progress dots + Next button */}
          <div className="flex items-center justify-between">
            {/* Progress dots */}
            <div className="flex gap-2">
              {ONBOARDING_STEPS.map((_, i) => (
                <span
                  key={i}
                  className={cn(
                    "w-1.5 h-1.5 rounded-full transition-colors",
                    i === step ? "bg-amber" : "bg-amber-faint/50",
                    i < step && "bg-amber-dim"
                  )}
                  style={
                    i === step
                      ? {
                          boxShadow:
                            "0 0 6px rgba(255, 149, 0, 0.5)",
                        }
                      : undefined
                  }
                />
              ))}
            </div>

            {/* Next / Finish button */}
            <button
              onClick={handleNext}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2",
                "border border-amber text-amber",
                "font-mono text-xs tracking-wider uppercase",
                "hover:bg-amber/10 transition-colors"
              )}
            >
              <span>
                {step < ONBOARDING_STEPS.length - 1 ? "NEXT" : "GET STARTED"}
              </span>
              <ChevronRight size={14} strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
