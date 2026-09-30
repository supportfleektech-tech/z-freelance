"use client";

import Link from "next/link";
import { ArrowRight, Search, ShieldCheck, Lock, Landmark, Sparkles } from "lucide-react";
import { TypeWriter, CountUp } from "@/components/motion";

/**
 * Landing hero — looping typewriter headline over an animated escrow visual.
 * The visual is pure CSS/DOM (no image downloads, perfect at any DPI).
 */
export function LandingHero({
  freelancerCount,
  openProjects,
  paidVolume,
}: {
  freelancerCount: number;
  openProjects: number;
  paidVolume: string;
}) {
  return (
    <section className="noise relative overflow-hidden border-b border-ink-200/60 bg-ink-50">
      {/* Aurora backdrop */}
      <div aria-hidden className="absolute inset-0">
        <div className="aurora-blob left-[-10%] top-[-20%] h-[34rem] w-[34rem] animate-aurora bg-brand-300/50" />
        <div className="aurora-blob right-[-12%] top-[8%] h-[30rem] w-[30rem] animate-aurora bg-amber-200/60 [animation-delay:-6s]" />
        <div className="aurora-blob bottom-[-30%] left-[30%] h-[26rem] w-[26rem] animate-aurora bg-emerald-200/50 [animation-delay:-11s]" />
        <div className="grid-pattern absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" />
      </div>

      <div className="container-page relative grid gap-14 py-16 sm:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-24">
        {/* ------------------------------------------------------- copy */}
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white/80 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-brand-700 shadow-card backdrop-blur">
            <Sparkles size={13} className="text-amber-500" aria-hidden />
            Escrow built in · no fee until release
          </div>

          <h1 className="mt-6 font-display text-[2.6rem] font-black leading-[1.04] tracking-tight text-ink-950 sm:text-6xl">
            <TypeWriter phrases={["Hire great freelancers.", "Pay only when work is delivered."]} />
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-600">
            Post a project, get proposals from vetted specialists across the globe, and fund
            milestones into escrow. Money moves only when you approve the work — never before.
          </p>

          <div className="mt-9 flex flex-wrap gap-3">
            <Link href="/register" className="btn-primary btn-lg">
              Post a project — it&apos;s free
              <ArrowRight size={18} />
            </Link>
            <Link href="/projects" className="btn-secondary btn-lg">
              <Search size={18} />
              Browse open work
            </Link>
          </div>

          <dl className="mt-12 grid max-w-lg grid-cols-3 gap-6">
            <HeroStat value={<CountUp value={freelancerCount} />} label="Freelancers ready" />
            <HeroStat value={<CountUp value={openProjects} />} label="Open projects" />
            <HeroStat value={<>{paidVolume}</>} label="Moved through escrow" />
          </dl>
        </div>

        {/* --------------------------------------------- animated visual */}
        <div className="relative mx-auto w-full max-w-md lg:max-w-none" aria-hidden>
          <EscrowVisual />
        </div>
      </div>
    </section>
  );
}

function HeroStat({ value, label }: { value: React.ReactNode; label: string }) {
  return (
    <div className="relative">
      <dd className="font-display text-3xl font-black text-ink-950">{value}</dd>
      <dt className="mt-1 text-[11px] font-bold uppercase tracking-[0.14em] text-ink-500">
        {label}
      </dt>
    </div>
  );
}

/**
 * The product in one glance: a milestone card whose escrow state machine
 * cycles FUNDED → DELIVERED → RELEASED, surrounded by floating chips.
 */
function EscrowVisual() {
  return (
    <div className="relative">
      {/* Main card */}
      <div className="card relative overflow-hidden p-6 shadow-pop">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-glow">
              <ShieldCheck size={18} />
            </span>
            <div>
              <p className="text-sm font-bold text-ink-950">Milestone 2 · Mobile checkout</p>
              <p className="text-xs text-ink-500">Lena K. × Northwind Studio</p>
            </div>
          </div>
          <span className="badge bg-amber-100 font-bold text-amber-900">$1,850</span>
        </div>

        {/* State machine bar */}
        <div className="mt-6 space-y-3">
          {[
            { label: "Funded into escrow", done: true },
            { label: "Delivered for review", done: true },
            { label: "Approved — releasing…", active: true },
          ].map((row) => (
            <div key={row.label} className="flex items-center gap-3">
              <span
                className={[
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-[10px] font-black transition-colors",
                  row.done
                    ? "border-brand-600 bg-brand-600 text-white"
                    : row.active
                      ? "border-amber-400 bg-amber-100 text-amber-800"
                      : "border-ink-200 bg-white text-ink-400",
                ].join(" ")}
              >
                {row.done ? (
                  <svg
                    viewBox="0 0 24 24"
                    className="h-3.5 w-3.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path
                      d="M4 12.5l5.5 5.5L20 7"
                      className="animate-draw-check"
                      style={{ strokeDasharray: 34 }}
                    />
                  </svg>
                ) : (
                  <span
                    className={
                      row.active
                        ? "h-2 w-2 animate-ping rounded-full bg-amber-500"
                        : "h-2 w-2 rounded-full bg-current opacity-50"
                    }
                  />
                )}
              </span>
              <p
                className={`text-sm ${row.done ? "font-semibold text-ink-900" : row.active ? "font-semibold text-amber-800" : "text-ink-400"}`}
              >
                {row.label}
              </p>
            </div>
          ))}
        </div>

        {/* Fee split bar */}
        <div className="mt-6">
          <div className="flex justify-between text-[11px] font-bold uppercase tracking-wider text-ink-500">
            <span>Freelancer wallet</span>
            <span>Platform fee 10%</span>
          </div>
          <div className="mt-2 flex h-3 overflow-hidden rounded-full bg-ink-100">
            <div className="h-full w-[90%] origin-left animate-bar-grow bg-gradient-to-r from-brand-500 to-brand-600" />
            <div className="h-full w-[10%] origin-left animate-bar-grow bg-amber-400" />
          </div>
          <div className="mt-2 flex justify-between text-xs font-semibold text-ink-600">
            <span>$1,665 lands instantly</span>
            <span>$185</span>
          </div>
        </div>
      </div>

      {/* Floating chips */}
      <div
        className="absolute -left-6 -top-6 hidden animate-float rounded-2xl border border-ink-200/70 bg-white/95 px-4 py-3 shadow-pop sm:block"
        style={{ animationDelay: "-1.2s" }}
      >
        <div className="flex items-center gap-2">
          <Lock size={14} className="text-brand-600" />
          <p className="text-xs font-bold text-ink-900">Funds locked in escrow</p>
        </div>
        <p className="mt-0.5 text-[11px] text-ink-500">Neither side can touch them</p>
      </div>

      <div
        className="absolute -bottom-7 -right-4 hidden animate-float rounded-2xl border border-ink-200/70 bg-white/95 px-4 py-3 shadow-pop sm:block"
        style={{ animationDelay: "-3.4s" }}
      >
        <div className="flex items-center gap-2">
          <Landmark size={14} className="text-amber-500" />
          <p className="text-xs font-bold text-ink-900">Payout approved</p>
        </div>
        <p className="mt-0.5 text-[11px] text-ink-500">Released on approval, instantly</p>
      </div>

      <div className="aurora-blob -bottom-16 -left-16 h-48 w-48 bg-amber-300/40" />
      <div className="aurora-blob -right-10 -top-14 h-40 w-40 bg-brand-300/40" />
    </div>
  );
}
