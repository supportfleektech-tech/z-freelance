import Link from "next/link";
import { Search } from "lucide-react";
import { searchFreelancers } from "@/server/services/freelancer.service";
import { freelancerQuerySchema } from "@/lib/validation";
import { formatMoneyCompact } from "@/lib/money";
import {
  Badge,
  EmptyState,
  Pagination,
  PageHeader,
  Stars,
  Avatar,
  StatusBadge,
} from "@/components/ui";

export const metadata = { title: "Find freelancers" };
export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function FreelancersPage({ searchParams }: Props) {
  const raw = await searchParams;
  const flat = Object.fromEntries(
    Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? (v[0] ?? "") : (v ?? "")]),
  );
  const parsed = freelancerQuerySchema.safeParse(flat);
  const query = parsed.success ? parsed.data : freelancerQuerySchema.parse({});

  const result = await searchFreelancers(query);

  return (
    <main className="container-page py-10">
      <PageHeader
        title="Independent specialists"
        description="Every profile shows verified contracts, ratings from real engagements, and lifetime platform earnings."
      />

      <form
        method="GET"
        className="card mb-8 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5"
        role="search"
      >
        <div className="relative lg:col-span-2">
          <Search className="absolute left-3 top-2.5 text-ink-400" size={16} />
          <input
            name="q"
            defaultValue={query.q}
            placeholder="Name, headline or keyword…"
            className="input pl-9"
          />
        </div>
        <input
          name="skill"
          defaultValue={query.skill}
          placeholder="Skill (e.g. Next.js)"
          className="input"
        />
        <select name="availability" defaultValue={query.availability ?? ""} className="input">
          <option value="">Any availability</option>
          <option value="AVAILABLE">Available now</option>
          <option value="BUSY">Busy</option>
        </select>
        <div className="flex gap-2">
          <select name="sort" defaultValue={query.sort} className="input">
            <option value="rating">Top rated</option>
            <option value="rate_low">Rate, low→high</option>
            <option value="rate_high">Rate, high→low</option>
            <option value="newest">Newest members</option>
          </select>
          <button type="submit" className="btn-primary btn-sm shrink-0">
            Filter
          </button>
        </div>
      </form>

      {result.items.length === 0 ? (
        <EmptyState
          title="No freelancers match"
          description="Try fewer filters — or post a project and let specialists come to you."
          action={
            <Link href="/register" className="btn-secondary btn-sm">
              Post a project
            </Link>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {result.items.map((f) => (
            <Link
              key={f.profileId}
              href={`/freelancers/${f.profileId}`}
              className="card group flex flex-col p-5 hover:border-brand-300"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <Avatar name={f.name} id={f.userId} avatarUrl={f.avatarUrl} />
                  <div>
                    <p className="font-semibold text-ink-900 group-hover:text-brand-700">
                      {f.name}
                    </p>
                    <Stars rating={f.ratingAvg} count={f.ratingCount} />
                  </div>
                </div>
                <StatusBadge status={f.availability} />
              </div>
              <p className="mt-3 line-clamp-2 min-h-10 text-sm text-ink-600">
                {f.headline ?? "Independent specialist"}
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {f.skills.slice(0, 4).map((skill) => (
                  <Badge key={skill}>{skill}</Badge>
                ))}
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 border-t border-ink-100 pt-3 text-center">
                <div>
                  <p className="text-sm font-bold text-ink-900">{f.completedContracts}</p>
                  <p className="text-[11px] text-ink-500">contracts</p>
                </div>
                <div>
                  <p className="text-sm font-bold text-ink-900">
                    {f.ratingAvg > 0 ? f.ratingAvg.toFixed(1) : "—"}
                  </p>
                  <p className="text-[11px] text-ink-500">rating</p>
                </div>
                <div>
                  <p className="text-sm font-bold text-ink-900">
                    {f.hourlyRateCents != null ? `${formatMoneyCompact(f.hourlyRateCents)}` : "—"}
                  </p>
                  <p className="text-[11px] text-ink-500">per hour</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <Pagination
        page={result.page}
        pageSize={result.pageSize}
        total={result.total}
        basePath="/freelancers"
        params={flat}
      />
    </main>
  );
}
