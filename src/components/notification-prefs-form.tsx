"use client";

import { useState } from "react";
import { fetchJson } from "@/lib/api-client";

/**
 * Per-type in-app notification switches. Saves on toggle — there is no
 * separate submit step because a preference page should never lose state.
 * Absent means enabled, matching the server default.
 */

interface PrefGroup {
  label: string;
  description: string;
  types: Array<{ key: string; label: string }>;
}

export const PREF_GROUPS: PrefGroup[] = [
  {
    label: "Proposals",
    description: "Movement on bids — yours and the ones on your projects.",
    types: [
      { key: "PROPOSAL_RECEIVED", label: "New proposal on my project" },
      { key: "PROPOSAL_SHORTLISTED", label: "My proposal was shortlisted" },
      { key: "PROPOSAL_REJECTED", label: "My proposal was declined" },
      { key: "PROPOSAL_WITHDRAWN", label: "A proposal was withdrawn" },
    ],
  },
  {
    label: "Contracts & escrow",
    description: "The money loop: funding, delivery and release events.",
    types: [
      { key: "CONTRACT_STARTED", label: "Contract started" },
      { key: "MILESTONE_FUNDED", label: "Milestone funded" },
      { key: "WORK_SUBMITTED", label: "Work submitted for review" },
      { key: "MILESTONE_APPROVED", label: "Milestone approved & released" },
    ],
  },
  {
    label: "Messages & reviews",
    description: "Conversation and reputation.",
    types: [
      { key: "MESSAGE_RECEIVED", label: "New message" },
      { key: "REVIEW_RECEIVED", label: "Reviews and review responses" },
    ],
  },
  {
    label: "Projects, disputes, payouts & account",
    description: "Operational events you almost always want to know about.",
    types: [
      { key: "PROJECT_PUBLISHED", label: "Project published" },
      { key: "DISPUTE_OPENED", label: "Dispute opened" },
      { key: "DISPUTE_RESOLVED", label: "Dispute resolved" },
      { key: "PAYOUT_PAID", label: "Payout paid out" },
      { key: "ACCOUNT_SUSPENDED", label: "Account status changes" },
    ],
  },
];

export function NotificationPrefsForm({ initialPrefs }: { initialPrefs: Record<string, boolean> }) {
  const [prefs, setPrefs] = useState<Record<string, boolean>>(initialPrefs);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggle(key: string) {
    const nextEnabled = prefs[key] === false; // currently disabled → enable
    const next = { ...prefs };
    if (nextEnabled) delete next[key];
    else next[key] = false;
    setPrefs(next);
    setBusyKey(key);
    setError(null);
    try {
      await fetchJson<{ prefs: Record<string, boolean> }>("/api/me/notification-prefs", {
        method: "PATCH",
        body: JSON.stringify({ [key]: nextEnabled }),
      });
    } catch (err) {
      // Roll the toggle back on failure.
      setPrefs(prefs);
      setError(err instanceof Error ? err.message : "Could not save the preference.");
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="space-y-6">
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {PREF_GROUPS.map((group) => (
        <section key={group.label}>
          <h3 className="text-sm font-semibold text-ink-900">{group.label}</h3>
          <p className="mb-2 text-xs text-ink-500">{group.description}</p>
          <ul className="divide-y divide-ink-100 rounded-xl border border-ink-200">
            {group.types.map((type) => {
              const enabled = prefs[type.key] !== false;
              return (
                <li key={type.key} className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-sm text-ink-800">{type.label}</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={enabled}
                    aria-label={`${type.label} notifications`}
                    disabled={busyKey === type.key}
                    onClick={() => void toggle(type.key)}
                    className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                      enabled ? "bg-brand-600" : "bg-ink-200"
                    } ${busyKey === type.key ? "opacity-60" : ""}`}
                  >
                    <span
                      className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                        enabled ? "left-[22px]" : "left-0.5"
                      }`}
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
