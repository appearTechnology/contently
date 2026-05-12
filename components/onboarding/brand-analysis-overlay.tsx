"use client";

import { createPortal } from "react-dom";
import { useEffect, useId, useState } from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_LINES = [
  "Connecting to your site…",
  "Pulling colours and type…",
  "Reading your page…",
  "Mapping your brand DNA…",
  "Almost there…",
] as const;

const BAR_STYLES = [
  "bg-[oklch(0.55_0.2_250)]",
  "bg-[oklch(0.6_0.18_200)]",
  "bg-[oklch(0.65_0.15_145)]",
  "bg-[oklch(0.7_0.17_85)]",
  "bg-[oklch(0.72_0.14_35)]",
];

/**
 * Full-screen loading state while importing a URL. Parent should only render
 * while import is in progress (and pass a changing `key` per run if needed).
 */
export function BrandAnalysisOverlay() {
  const [step, setStep] = useState(0);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const t = window.setInterval(() => {
      setStep((s) => (s + 1) % STATUS_LINES.length);
    }, 2400);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descId}
      aria-busy="true"
      className="animate-in fade-in fixed inset-0 z-[200] flex items-center justify-center duration-200"
    >
      <div className="bg-background/85 absolute inset-0 backdrop-blur-md" />
      <div className="relative z-10 flex max-w-sm flex-col items-center gap-8 px-6 text-center">
        <div className="relative flex size-28 items-center justify-center">
          <div
            className="animate-brand-orbit border-primary/25 absolute inset-0 rounded-full border-2"
            aria-hidden
          />
          <div
            className="animate-brand-orbit-reverse border-primary/15 absolute inset-3 rounded-full border border-dashed"
            aria-hidden
          />
          <Sparkles
            className="animate-brand-pulse-soft text-primary relative size-10"
            aria-hidden
          />
        </div>

        <div className="space-y-3">
          <h2
            id={titleId}
            className="font-heading text-xl font-semibold tracking-tight sm:text-2xl"
          >
            Analysing your brand
          </h2>
          <p
            id={descId}
            key={step}
            className="text-muted-foreground animate-in fade-in slide-in-from-bottom-1 text-sm leading-relaxed duration-300 sm:text-base"
          >
            {STATUS_LINES[step]}
          </p>
        </div>

        <div
          className="flex h-14 items-end justify-center gap-1.5 sm:gap-2"
          aria-hidden
        >
          {BAR_STYLES.map((bg, i) => (
            <span
              key={i}
              className={cn(
                "animate-brand-dna-bar h-full max-h-12 min-h-3 w-2 origin-bottom rounded-full sm:w-2.5",
                bg,
              )}
              style={{ animationDelay: `${i * 0.1}s` }}
            />
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}
