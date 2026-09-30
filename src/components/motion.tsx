"use client";

/**
 * Motion primitives — zero dependencies, transform/opacity only, and every
 * effect bows to `prefers-reduced-motion` (the CSS layer kills animations;
 * these components also render their *final* state immediately).
 */

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/utils";

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/* ---------------------------------------------------------------- Reveal */

/**
 * Fades content up as it scrolls into view (once). `delay` staggers groups.
 * SSR renders the hidden state and the observer upgrades it on hydrate —
 * content is never invisible to no-JS crawlers because the CSS class is what
 * hides it, and .reveal is respected by print styles too.
 */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (prefersReducedMotion()) {
      el.classList.add("visible");
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={cn("reveal", className)}
      style={{ "--reveal-delay": `${delay}ms` } as CSSProperties}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------ TypeWriter */

/**
 * Looping typewriter: types each phrase, holds, erases, advances forever.
 * SSR prints the first phrase fully (great for no-JS + SEO), then animates.
 */
export function TypeWriter({
  phrases,
  className,
  typeMs = 65,
  eraseMs = 32,
  holdMs = 2200,
}: {
  phrases: string[];
  className?: string;
  typeMs?: number;
  eraseMs?: number;
  holdMs?: number;
}) {
  const [text, setText] = useState(phrases[0] ?? "");
  const [animated, setAnimated] = useState(false);
  const stateRef = useRef({ phrase: 0, char: (phrases[0] ?? "").length, deleting: false });

  useEffect(() => {
    if (prefersReducedMotion() || phrases.length <= 1) return;
    setAnimated(true);
    let timer: ReturnType<typeof setTimeout>;

    const tick = () => {
      const s = stateRef.current;
      const full = phrases[s.phrase % phrases.length] ?? "";

      if (!s.deleting) {
        if (s.char < full.length) {
          s.char += 1;
          setText(full.slice(0, s.char));
          timer = setTimeout(tick, typeMs + Math.random() * 40);
          return;
        }
        s.deleting = true;
        timer = setTimeout(tick, holdMs);
        return;
      }

      if (s.char > 0) {
        s.char -= 1;
        setText(full.slice(0, s.char));
        timer = setTimeout(tick, eraseMs);
        return;
      }
      s.deleting = false;
      s.phrase += 1;
      timer = setTimeout(tick, 350);
    };

    // Start from the fully-typed SSR state: hold, then erase.
    stateRef.current.deleting = true;
    timer = setTimeout(tick, holdMs);
    return () => clearTimeout(timer);
  }, [phrases, typeMs, eraseMs, holdMs]);

  return (
    <span className={className} aria-label={phrases.join(" ")}>
      <span aria-hidden>{animated ? text : phrases[0]}</span>
      <span
        aria-hidden
        className="ml-1 inline-block h-[0.85em] w-[3px] translate-y-[0.08em] animate-caret-blink rounded-full bg-current"
      />
    </span>
  );
}

/* --------------------------------------------------------------- CountUp */

/** Animates an integer from 0 to value when it scrolls into view. */
export function CountUp({
  value,
  duration = 1100,
  prefix = "",
  suffix = "",
  className,
}: {
  value: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (prefersReducedMotion()) {
      setDisplay(value);
      return;
    }
    let frame = 0;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        observer.disconnect();
        const start = performance.now();
        const step = (now: number) => {
          const t = Math.min(1, (now - start) / duration);
          const eased = 1 - Math.pow(1 - t, 3);
          setDisplay(Math.round(value * eased));
          if (t < 1) frame = requestAnimationFrame(step);
        };
        frame = requestAnimationFrame(step);
      },
      { threshold: 0.4 },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [value, duration]);

  return (
    <span ref={ref} className={cn("tabular-nums", className)}>
      {prefix}
      {display.toLocaleString()}
      {suffix}
    </span>
  );
}
