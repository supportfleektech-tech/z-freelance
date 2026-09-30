"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fetchJson } from "@/lib/api-client";
import { Alert, Card } from "./ui";
import { parseList } from "@/lib/utils";

interface Category {
  id: string;
  name: string;
}

export function PostProjectForm({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [budgetType, setBudgetType] = useState<"FIXED" | "HOURLY">("FIXED");
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [experienceLevel, setExperienceLevel] = useState("INTERMEDIATE");
  const [deadline, setDeadline] = useState("");
  const [skills, setSkills] = useState("");

  async function save(publish: boolean) {
    setError(null);
    setPending(true);
    try {
      const { data } = await fetchJson<{ id: string; status: string }>(`/api/projects`, {
        method: "POST",
        body: JSON.stringify({
          title,
          description,
          categoryId: categoryId || undefined,
          budgetType,
          budgetMinCents: budgetMin ? Math.round(Number.parseFloat(budgetMin) * 100) : null,
          budgetMaxCents: budgetMax ? Math.round(Number.parseFloat(budgetMax) * 100) : null,
          experienceLevel,
          deadline: deadline ? new Date(deadline).toISOString() : undefined,
          skills: parseList(skills, 8),
          publish,
        }),
      });
      router.push(`/dashboard/projects/${data.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the project.");
      setPending(false);
    }
  }

  return (
    <Card className="max-w-3xl">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save(true);
        }}
        className="space-y-5"
      >
        {error ? <Alert tone="error">{error}</Alert> : null}

        <div>
          <label htmlFor="title" className="label">
            Project title
          </label>
          <input
            id="title"
            className="input"
            placeholder="e.g. Build a Next.js billing dashboard with usage-based invoicing"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            minLength={10}
            maxLength={160}
          />
        </div>

        <div>
          <label htmlFor="description" className="label">
            Description
          </label>
          <textarea
            id="description"
            className="input min-h-40"
            placeholder="What does success look like? What context does a specialist need? What's already built, and what will they own?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            minLength={40}
            maxLength={8000}
          />
          <p className="mt-1 text-xs text-ink-400">
            {description.length}/8000 · minimum 40 characters
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="category" className="label">
              Category
            </label>
            <select
              id="category"
              className="input"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">Choose a category…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="level" className="label">
              Experience level
            </label>
            <select
              id="level"
              className="input"
              value={experienceLevel}
              onChange={(e) => setExperienceLevel(e.target.value)}
            >
              <option value="ENTRY">Entry</option>
              <option value="INTERMEDIATE">Intermediate</option>
              <option value="EXPERT">Expert</option>
            </select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="budgetType" className="label">
              Budget type
            </label>
            <select
              id="budgetType"
              className="input"
              value={budgetType}
              onChange={(e) => setBudgetType(e.target.value as "FIXED" | "HOURLY")}
            >
              <option value="FIXED">Fixed price</option>
              <option value="HOURLY">Hourly</option>
            </select>
          </div>
          <div>
            <label htmlFor="budgetMin" className="label">
              Min (USD)
            </label>
            <input
              id="budgetMin"
              type="number"
              min="0"
              step="0.01"
              className="input"
              placeholder="8,000"
              value={budgetMin}
              onChange={(e) => setBudgetMin(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="budgetMax" className="label">
              Max (USD)
            </label>
            <input
              id="budgetMax"
              type="number"
              min="0"
              step="0.01"
              className="input"
              placeholder="12,000"
              value={budgetMax}
              onChange={(e) => setBudgetMax(e.target.value)}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="deadline" className="label">
              Delivery deadline
            </label>
            <input
              id="deadline"
              type="date"
              className="input"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="skills" className="label">
              Skills needed
            </label>
            <input
              id="skills"
              className="input"
              placeholder="Next.js, TypeScript, PostgreSQL"
              value={skills}
              onChange={(e) => setSkills(e.target.value)}
            />
            <p className="mt-1 text-xs text-ink-400">Comma separated, up to 8.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-ink-100 pt-5">
          <button type="submit" className="btn-primary" disabled={pending}>
            {pending ? "Publishing…" : "Publish project"}
          </button>
          <button
            type="button"
            className="btn-secondary"
            disabled={pending}
            onClick={() => void save(false)}
          >
            {pending ? "Saving…" : "Save as draft"}
          </button>
          <p className="text-xs text-ink-400">Drafts are invisible until published.</p>
        </div>
      </form>
    </Card>
  );
}
