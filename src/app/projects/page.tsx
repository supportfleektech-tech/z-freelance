import Link from "next/link";
import { Search } from "lucide-react";
import { searchProjects } from "@/server/services/project.service";
import { listCategories } from "@/server/services/taxonomy.service";
import { db as getDb } from "@/lib/db";
import { projectQuerySchema } from "@/lib/validation";
import { formatBudget } from "@/lib/money";
import { excerpt, timeAgo } from "@/lib/utils";
import { Badge, StatusBadge, EmptyState, Pagination, PageHeader, Stars } from "@/components/ui";

export const metadata = { title: "Browse projects" };
export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ProjectsPage({ searchParams }: Props) {
  const raw = await searchParams;
  const flat = Object.fromEntries(
    Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? (v[0] ?? "") : (v ?? "")]),
  );
  const parsed = projectQuerySchema.safeParse(flat);
  const query = parsed.success ? parsed.data : projectQuerySchema.parse({});

  const database = await getDb();
  const [result, categories] = await Promise.all([searchProjects(query), listCategories(database)]);

  return (
    <main className="container-page py-10">
      <PageHeader
        title="Find your next project"
        description="Every project below has a committed budget. Funded milestones mean the client's money is already in escrow."
      />

      {/* GET form = shareable filter URLs, no JS required. */}
      <form
        method="GET"
        className="card mb-8 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-6"
        role="search"
      >
        <div className="relative lg:col-span-2">
          <Search className="absolute left-3 top-2.5 text-ink-400" size={16} />
          <input
            name="q"
            defaultValue={query.q}
            placeholder="Search titles and descriptions…"
            className="input pl-9"
          />
        </div>
        <select name="categoryId" defaultValue={query.categoryId ?? ""} className="input">
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select name="budgetType" defaultValue={query.budgetType ?? ""} className="input">
          <option value="">Any budget type</option>
          <option value="FIXED">Fixed price</option>
          <option value="HOURLY">Hourly</option>
        </select>
        <select name="experienceLevel" defaultValue={query.experienceLevel ?? ""} className="input">
          <option value="">Any level</option>
          <option value="ENTRY">Entry</option>
          <option value="INTERMEDIATE">Intermediate</option>
          <option value="EXPERT">Expert</option>
        </select>
        <div className="flex gap-2">
          <select name="sort" defaultValue={query.sort} className="input">
            <option value="newest">Newest</option>
            <option value="budget_high">Budget, high→low</option>
            <option value="budget_low">Budget, low→high</option>
            <option value="proposals">Most proposals</option>
          </select>
          <button type="submit" className="btn-primary btn-sm shrink-0">
            Filter
          </button>
        </div>
      </form>

      {result.items.length === 0 ? (
        <EmptyState
          title="No matching projects"
          description="Try widening your filters or clearing the search. New projects are posted throughout the day."
          action={
            <Link href="/projects" className="btn-secondary btn-sm">
              Clear filters
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {result.items.map((project) => (
            <Link
              key={project.id}
              href={`/projects/${project.id}`}
              className="card group grid gap-4 p-5 transition-colors hover:border-brand-300 sm:grid-cols-[1fr_auto]"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-semibold text-ink-900 group-hover:text-brand-700">
                    {project.title}
                  </h2>
                  <StatusBadge status={project.status} />
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-ink-500">
                  {excerpt(project.description, 220)}
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {project.skillNames.slice(0, 5).map((skill) => (
                    <Badge key={skill}>{skill}</Badge>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-500">
                  <span>Posted {timeAgo(project.publishedAt)}</span>
                  <span>{project.proposalsCount} proposals</span>
                  <span>{project.categoryName ?? "General"}</span>
                  <span className="capitalize">{project.experienceLevel.toLowerCase()} level</span>
                </div>
              </div>
              <div className="flex flex-col items-start justify-between gap-2 sm:items-end">
                <div className="text-left sm:text-right">
                  <p className="text-lg font-bold tabular-nums text-ink-950">
                    {formatBudget(
                      project.budgetMinCents,
                      project.budgetMaxCents,
                      project.budgetType,
                    )}
                  </p>
                  <p className="text-xs text-ink-500">
                    {project.budgetType === "HOURLY" ? "hourly" : "fixed price"}
                  </p>
                </div>
                <Stars rating={project.clientRating} />
              </div>
            </Link>
          ))}
        </div>
      )}

      <Pagination
        page={result.page}
        pageSize={result.pageSize}
        total={result.total}
        basePath="/projects"
        params={flat}
      />
    </main>
  );
}
