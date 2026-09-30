"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fetchJson } from "@/lib/api-client";
import { Alert } from "./ui";
import { parseList } from "@/lib/utils";

interface FreelancerInitial {
  headline: string | null;
  bio: string | null;
  hourlyRateCents: number | null;
  country: string | null;
  city: string | null;
  availability: "AVAILABLE" | "BUSY" | "UNAVAILABLE";
  yearsExperience: number;
  portfolioUrl: string | null;
  githubUrl: string | null;
  linkedinUrl: string | null;
}

interface ClientInitial {
  companyName: string | null;
  website: string | null;
  bio: string | null;
  country: string | null;
  city: string | null;
}

export function ProfileForm(props: {
  role: "CLIENT" | "FREELANCER" | "ADMIN";
  freelancer: FreelancerInitial | null;
  client: ClientInitial | null;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<{ kind: "ok" | "error"; message: string } | null>(null);
  const [pending, setPending] = useState(false);

  const f = props.freelancer;
  const c = props.client;

  const [form, setForm] = useState({
    headline: f?.headline ?? "",
    bio: f?.bio ?? c?.bio ?? "",
    rate: f?.hourlyRateCents != null ? (f.hourlyRateCents / 100).toFixed(0) : "",
    country: f?.country ?? c?.country ?? "",
    city: f?.city ?? c?.city ?? "",
    availability: f?.availability ?? "AVAILABLE",
    yearsExperience: f?.yearsExperience ?? 0,
    portfolioUrl: f?.portfolioUrl ?? "",
    githubUrl: f?.githubUrl ?? "",
    linkedinUrl: f?.linkedinUrl ?? "",
    companyName: c?.companyName ?? "",
    website: c?.website ?? "",
    skills: "",
  });

  // Skills field stays blank on purpose: leaving it empty keeps the current set unchanged.
  const set = (patch: Partial<typeof form>) => setForm((prev) => ({ ...prev, ...patch }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setStatus(null);
    setPending(true);
    try {
      const body: Record<string, unknown> =
        props.role === "FREELANCER"
          ? {
              headline: form.headline || undefined,
              bio: form.bio || undefined,
              hourlyRateCents: form.rate ? Math.round(Number.parseFloat(form.rate) * 100) : null,
              country: form.country || undefined,
              city: form.city || undefined,
              availability: form.availability,
              yearsExperience: Number(form.yearsExperience) || 0,
              portfolioUrl: form.portfolioUrl || undefined,
              githubUrl: form.githubUrl || undefined,
              linkedinUrl: form.linkedinUrl || undefined,
              ...(form.skills.trim() ? { skills: parseList(form.skills, 20) } : {}),
            }
          : {
              companyName: form.companyName || undefined,
              website: form.website || undefined,
              bio: form.bio || undefined,
              country: form.country || undefined,
              city: form.city || undefined,
            };

      await fetchJson(`/api/me/profile`, { method: "PATCH", body: JSON.stringify(body) });
      setStatus({ kind: "ok", message: "Profile saved." });
      router.refresh();
    } catch (err) {
      setStatus({ kind: "error", message: err instanceof Error ? err.message : "Save failed." });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {status ? (
        <Alert tone={status.kind === "ok" ? "success" : "error"}>{status.message}</Alert>
      ) : null}

      {props.role === "FREELANCER" ? (
        <>
          <div>
            <label className="label" htmlFor="pf-headline">
              Headline
            </label>
            <input
              id="pf-headline"
              className="input"
              placeholder="Full-stack TypeScript engineer"
              maxLength={160}
              value={form.headline}
              onChange={(e) => set({ headline: e.target.value })}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="pf-rate">
                Hourly rate (USD)
              </label>
              <input
                id="pf-rate"
                type="number"
                min="0"
                className="input"
                placeholder="95"
                value={form.rate}
                onChange={(e) => set({ rate: e.target.value })}
              />
            </div>
            <div>
              <label className="label" htmlFor="pf-years">
                Years of experience
              </label>
              <input
                id="pf-years"
                type="number"
                min="0"
                max="60"
                className="input"
                value={form.yearsExperience}
                onChange={(e) => set({ yearsExperience: Number(e.target.value) })}
              />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="pf-availability">
              Availability
            </label>
            <select
              id="pf-availability"
              className="input"
              value={form.availability}
              onChange={(e) => set({ availability: e.target.value as typeof form.availability })}
            >
              <option value="AVAILABLE">Available now</option>
              <option value="BUSY">Busy — limited capacity</option>
              <option value="UNAVAILABLE">Unavailable</option>
            </select>
          </div>
        </>
      ) : (
        <div>
          <label className="label" htmlFor="pf-company">
            Company name
          </label>
          <input
            id="pf-company"
            className="input"
            placeholder="Northwind Labs"
            maxLength={160}
            value={form.companyName}
            onChange={(e) => set({ companyName: e.target.value })}
          />
        </div>
      )}

      <div>
        <label className="label" htmlFor="pf-bio">
          About you
        </label>
        <textarea
          id="pf-bio"
          className="input min-h-32"
          maxLength={4000}
          placeholder={
            props.role === "FREELANCER"
              ? "Your specialism, what you ship, how you work with clients…"
              : "What you build, how you hire, what success looks like…"
          }
          value={form.bio}
          onChange={(e) => set({ bio: e.target.value })}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="pf-city">
            City
          </label>
          <input
            id="pf-city"
            className="input"
            maxLength={80}
            value={form.city}
            onChange={(e) => set({ city: e.target.value })}
          />
        </div>
        <div>
          <label className="label" htmlFor="pf-country">
            Country
          </label>
          <input
            id="pf-country"
            className="input"
            maxLength={80}
            value={form.country}
            onChange={(e) => set({ country: e.target.value })}
          />
        </div>
      </div>

      {props.role === "FREELANCER" ? (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="label" htmlFor="pf-portfolio">
                Portfolio
              </label>
              <input
                id="pf-portfolio"
                className="input"
                placeholder="https://…"
                value={form.portfolioUrl}
                onChange={(e) => set({ portfolioUrl: e.target.value })}
              />
            </div>
            <div>
              <label className="label" htmlFor="pf-github">
                GitHub
              </label>
              <input
                id="pf-github"
                className="input"
                placeholder="https://github.com/…"
                value={form.githubUrl}
                onChange={(e) => set({ githubUrl: e.target.value })}
              />
            </div>
            <div>
              <label className="label" htmlFor="pf-linkedin">
                LinkedIn
              </label>
              <input
                id="pf-linkedin"
                className="input"
                placeholder="https://linkedin.com/in/…"
                value={form.linkedinUrl}
                onChange={(e) => set({ linkedinUrl: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="pf-skills">
              Skills (comma separated)
            </label>
            <input
              id="pf-skills"
              className="input"
              placeholder="TypeScript, React, PostgreSQL"
              value={form.skills}
              onChange={(e) => set({ skills: e.target.value })}
            />
            <p className="mt-1 text-xs text-ink-400">
              Leave blank to keep your current skills unchanged.
            </p>
          </div>
        </>
      ) : (
        <div>
          <label className="label" htmlFor="pf-website">
            Website
          </label>
          <input
            id="pf-website"
            className="input"
            placeholder="https://yourcompany.com"
            value={form.website}
            onChange={(e) => set({ website: e.target.value })}
          />
        </div>
      )}

      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Saving…" : "Save profile"}
      </button>
    </form>
  );
}
