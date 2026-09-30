"use client";

/**
 * The "tutorial video": a player-styled, auto-advancing animated walkthrough
 * of the escrow lifecycle — five scenes, seekable segments, play/pause/replay.
 * Pure CSS/DOM animation so it is crisp at any resolution and instantly
 * available (no video bytes to download or stream).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Play, Pause, RotateCcw, X, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const SCENE_MS = 4200;

const SCENES = [
  {
    key: "post",
    title: "1 · Post the project",
    caption:
      "A client describes the work and sets a budget. Posting is free — proposals arrive within hours.",
  },
  {
    key: "fund",
    title: "2 · Fund the milestone",
    caption:
      "The agreed amount moves into escrow BEFORE work starts. The freelancer knows the money is real.",
  },
  {
    key: "deliver",
    title: "3 · Work gets delivered",
    caption:
      "The freelancer submits files and notes against the milestone. Funds stay locked while you review.",
  },
  {
    key: "release",
    title: "4 · Approve & release",
    caption:
      "One click releases escrow: 90% to the freelancer's wallet, 10% platform fee — the only fee, ever.",
  },
  {
    key: "payout",
    title: "5 · Money moves out",
    caption:
      "The balance is payable on request, tracked in a double-entry ledger with a full audit trail.",
  },
] as const;

export function TourPlayer({ dark = false }: { dark?: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Video-poster trigger */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group relative block w-full overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-brand-950 via-brand-900 to-brand-800 text-left shadow-pop transition-transform duration-300 hover:-translate-y-1 focus-visible:ring-2 focus-visible:ring-amber-400"
        aria-label="Play the 60-second product tour"
      >
        <div className="grid-pattern absolute inset-0 opacity-40" />
        <div className="aurora-blob -left-10 -top-10 h-56 w-56 bg-amber-400/25" />
        <div className="aurora-blob -bottom-16 -right-8 h-56 w-56 bg-brand-400/30" />

        <div className="relative flex aspect-video flex-col items-center justify-center gap-4 p-8">
          {/* Mock player chrome */}
          <div className="absolute left-5 top-5 flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-brand-400" />
          </div>
          <div className="absolute right-5 top-5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-white/80 backdrop-blur">
            60-second tour
          </div>

          <span className="relative flex h-20 w-20 items-center justify-center">
            <span className="absolute inset-0 animate-pulse-ring rounded-full bg-amber-400/60" />
            <span className="relative flex h-20 w-20 items-center justify-center rounded-full bg-amber-400 text-ink-950 shadow-gold transition-transform duration-300 group-hover:scale-110">
              <Play size={30} className="translate-x-0.5 fill-current" />
            </span>
          </span>
          <p className="font-display text-lg font-bold text-white sm:text-xl">
            Watch how escrow protects both sides
          </p>
          <p className="text-sm text-brand-100/80">Post → Fund → Deliver → Release → Pay out</p>

          {/* Fake playback bar */}
          <div className="absolute inset-x-5 bottom-5">
            <div className="flex h-1.5 gap-1">
              {SCENES.map((s) => (
                <span key={s.key} className="h-full flex-1 rounded-full bg-white/20" />
              ))}
            </div>
          </div>
        </div>
      </button>

      {open ? <TourModal onClose={() => setOpen(false)} dark={dark} /> : null}
    </>
  );
}

function TourModal({ onClose }: { onClose: () => void; dark?: boolean }) {
  const [scene, setScene] = useState(0);
  const [playing, setPlaying] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const goTo = useCallback((index: number) => {
    setScene(((index % SCENES.length) + SCENES.length) % SCENES.length);
  }, []);

  useEffect(() => {
    if (!playing) return;
    timerRef.current = setTimeout(() => goTo(scene + 1), SCENE_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [scene, playing, goTo]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") goTo(scene + 1);
      if (e.key === "ArrowLeft") goTo(scene - 1);
      if (e.key === " ") {
        e.preventDefault();
        setPlaying((p) => !p);
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose, goTo, scene]);

  const current = SCENES[scene] ?? SCENES[0];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Product tour"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl animate-pop-in overflow-hidden rounded-3xl bg-white shadow-pop"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Stage */}
        <div className="relative aspect-video w-full overflow-hidden bg-gradient-to-br from-ink-50 to-brand-50">
          <TourScene key={current.key} scene={current.key} />
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 rounded-full bg-ink-950/40 p-2 text-white backdrop-blur transition-colors hover:bg-ink-950/70"
            aria-label="Close tour"
          >
            <X size={16} />
          </button>
        </div>

        {/* Title + caption */}
        <div className="px-6 pb-3 pt-5">
          <p className="font-display text-lg font-bold text-ink-950">{current.title}</p>
          <p className="mt-1 min-h-10 text-sm text-ink-600">{current.caption}</p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3 border-t border-ink-100 px-6 py-4">
          <button
            type="button"
            onClick={() => goTo(scene - 1)}
            className="btn-ghost btn-sm"
            aria-label="Previous scene"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            className="btn-primary btn-sm"
            aria-label={playing ? "Pause tour" : "Play tour"}
          >
            {playing ? <Pause size={14} /> : <Play size={14} />}
            {playing ? "Pause" : "Play"}
          </button>
          <button
            type="button"
            onClick={() => {
              goTo(0);
              setPlaying(true);
            }}
            className="btn-ghost btn-sm"
            aria-label="Replay tour"
          >
            <RotateCcw size={14} />
          </button>
          <button
            type="button"
            onClick={() => goTo(scene + 1)}
            className="btn-ghost btn-sm"
            aria-label="Next scene"
          >
            <ChevronRight size={16} />
          </button>

          {/* Segmented progress */}
          <div className="ml-2 flex flex-1 gap-1.5">
            {SCENES.map((s, i) => (
              <button
                key={s.key}
                type="button"
                onClick={() => {
                  goTo(i);
                  setPlaying(true);
                }}
                aria-label={`Scene ${i + 1}: ${s.title}`}
                className="group h-4 flex-1"
              >
                <span
                  className={cn(
                    "block h-1.5 w-full rounded-full transition-colors",
                    i < scene
                      ? "bg-brand-600"
                      : i === scene
                        ? "bg-amber-400 group-hover:bg-amber-500"
                        : "bg-ink-100 group-hover:bg-ink-200",
                  )}
                />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------- the five scenes */

function TourScene({ scene }: { scene: string }) {
  switch (scene) {
    case "post":
      return (
        <div className="flex h-full items-center justify-center p-8">
          <div className="card w-full max-w-sm space-y-3 p-5">
            <div className="h-3 w-2/3 animate-fade-up rounded bg-ink-200 [animation-delay:100ms]" />
            <div className="h-3 w-full animate-fade-up rounded bg-ink-100 [animation-delay:250ms]" />
            <div className="h-3 w-5/6 animate-fade-up rounded bg-ink-100 [animation-delay:400ms]" />
            <div className="flex gap-2 pt-1">
              <div className="h-8 flex-1 animate-pop-in rounded-xl bg-brand-100 [animation-delay:550ms]" />
              <div className="h-8 flex-1 animate-pop-in rounded-xl bg-brand-100 [animation-delay:700ms]" />
            </div>
            <div className="h-10 w-full animate-pop-in rounded-xl bg-gradient-to-r from-brand-600 to-brand-700 text-center align-middle text-sm font-bold leading-10 text-white [animation-delay:900ms]">
              Post project — free ✓
            </div>
          </div>
        </div>
      );
    case "fund":
      return (
        <div className="relative flex h-full items-center justify-center p-8">
          <div className="card relative w-64 p-5 text-center">
            <div className="mx-auto flex h-16 w-20 items-center justify-center rounded-t-2xl bg-gradient-to-b from-brand-600 to-brand-800 text-3xl">
              🔒
            </div>
            <p className="mt-3 text-sm font-bold text-ink-950">Escrow vault</p>
            <p className="text-xs text-ink-500">Funds locked until approval</p>
            {["–0.4s", "0s", "0.2s"].map((d, i) => (
              <span
                key={i}
                className="absolute left-1/2 top-full h-9 w-9 animate-coin-in rounded-full border-2 border-amber-500 bg-amber-300 text-center align-middle text-xs font-black leading-8 text-amber-900"
                style={{ animationDelay: d === "–0.4s" ? "0.1s" : d, left: `${42 + i * 10}%` }}
              >
                $
              </span>
            ))}
          </div>
          <div className="absolute bottom-8 animate-pop-in rounded-full bg-brand-600 px-4 py-1.5 text-xs font-bold text-white [animation-delay:1.4s]">
            ✓ FUNDED — work can begin
          </div>
        </div>
      );
    case "deliver":
      return (
        <div className="flex h-full items-center justify-center gap-10 p-8">
          <div className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-lg font-black text-white">
              LK
            </div>
            <p className="mt-1 text-xs font-semibold text-ink-600">Freelancer</p>
          </div>
          <div className="card animate-doc-fly p-4">
            <div className="h-2.5 w-28 rounded bg-ink-200" />
            <div className="mt-2 h-2.5 w-20 rounded bg-ink-100" />
            <div className="mt-2 h-2.5 w-24 rounded bg-ink-100" />
            <div className="mt-3 flex items-center gap-1.5 text-xs font-bold text-brand-700">
              📎 delivery-final.zip
            </div>
          </div>
          <div className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-400 text-lg font-black text-ink-950">
              NW
            </div>
            <p className="mt-1 text-xs font-semibold text-ink-600">Client</p>
          </div>
        </div>
      );
    case "release":
      return (
        <div className="relative flex h-full flex-col items-center justify-center gap-6 p-8">
          <div className="animate-pop-in rounded-2xl bg-gradient-to-r from-brand-600 to-brand-700 px-8 py-4 text-lg font-black text-white shadow-glow">
            ✓ Approve & release $1,850
          </div>
          <div className="w-full max-w-sm">
            <div className="flex h-8 overflow-hidden rounded-full bg-ink-100">
              <div className="flex h-full w-[90%] origin-left animate-bar-grow items-center justify-center bg-gradient-to-r from-brand-400 to-brand-600 text-[11px] font-bold text-white">
                Freelancer $1,665
              </div>
              <div className="flex h-full w-[10%] items-center justify-center bg-amber-400 text-[11px] font-bold text-ink-950">
                10%
              </div>
            </div>
          </div>
          {Array.from({ length: 10 }).map((_, i) => (
            <span
              key={i}
              aria-hidden
              className={cn(
                "absolute left-1/2 top-1/2 h-2.5 w-2.5",
                i % 3 === 0 ? "bg-brand-500" : i % 3 === 1 ? "bg-amber-400" : "bg-emerald-300",
              )}
              style={{
                animation: "confetti-burst 1.1s ease-out 0.7s both",
                ["--dx" as string]: `${(i - 4.5) * 34}px`,
                ["--dy" as string]: `${-60 - (i % 5) * 26}px`,
                ["--rz" as string]: `${(i * 47) % 360}deg`,
              }}
            />
          ))}
        </div>
      );
    default:
      return (
        <div className="flex h-full items-center justify-center p-8">
          <div className="text-center">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-ink-500">
              Freelancer wallet
            </p>
            <p className="mt-2 font-display text-5xl font-black text-ink-950">$4,120</p>
            <div className="mx-auto mt-4 w-64 rounded-2xl border border-brand-200 bg-brand-50 p-3 text-left">
              <p className="text-[11px] font-bold uppercase tracking-wider text-brand-700">
                Ledger entry
              </p>
              <p className="mt-1 text-xs text-ink-600">
                MILESTONE_RELEASE · milestone 2 · +$1,665 · ref escrow#1042
              </p>
            </div>
            <div className="mx-auto mt-3 w-64 animate-pop-in rounded-xl bg-amber-400 px-4 py-2 text-sm font-black text-ink-950 [animation-delay:600ms]">
              Request payout →
            </div>
          </div>
        </div>
      );
  }
}
