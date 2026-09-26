import Link from "next/link";
import { Search, ShieldCheck, Landmark, ArrowRight, Workflow, Star } from "lucide-react";
import { platformStats } from "@/server/services/admin.service";
import { listCategories } from "@/server/services/taxonomy.service";
import { searchFreelancers } from "@/server/services/freelancer.service";
import { searchProjects } from "@/server/services/project.service";
import { db as getDb } from "@/lib/db";
import { formatMoneyCompact, formatBudget } from "@/lib/money";
import { Badge, Avatar, Stars, StatusBadge } from "@/components/ui";
import { excerpt } from "@/lib/utils";

export const metadata = { title: "Hire freelancers with money held in escrow" };
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const database = await getDb();
  const [stats, categories, freelancers, projects] = await Promise.all([
    platformStats(),
    listCategories(database),
    searchFreelancers({ page: 1, pageSize: 4, sort: "rating" }),
    searchProjects({ page: 1, pageSize: 3, sort: "newest", status: "OPEN" }),
  ]);

  return (
    <main>
      {/* ------------------------------------------------------------ hero */}
      <section className="border-b border-ink-100 bg-gradient-to-b from-brand-50 to-white">
        <div className="container-page grid gap-12 py-20 lg:grid-cols-2 lg:items-center">
          <div>
            <Badge tone="blue" className="mb-4">
              Escrow built in · 10% fee, only on released work
            </Badge>
            <h1 className="text-4xl font-bold tracking-tight text-ink-950 sm:text-5xl">
              Hire great freelancers.
              <span className="block text-brand-700">Pay only when work is delivered.</span>
            </h1>
            <p className="mt-5 max-w-lg text-lg text-ink-600">
              Post a project, get proposals from vetted specialists, and fund milestones into
              escrow. Money only moves when you approve the delivery — or when an admin resolves a
              dispute.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/register" className="btn-primary">
                Post a project — it&apos;s free
                <ArrowRight size={16} />
              </Link>
              <Link href="/projects" className="btn-secondary">
                <Search size={16} />
                Browse open work
              </Link>
            </div>
            <dl className="mt-10 grid max-w-md grid-cols-3 gap-6">
              <HeroStat label="Freelancers" value={String(stats.users.freelancers)} />
              <HeroStat label="Open projects" value={String(stats.projects.open)} />
              <HeroStat
                label="Paid through escrow"
                value={formatMoneyCompact(stats.money.grossVolumeCents)}
              />
            </dl>
          </div>

          {/* The escrow flow card — the product explained in one visual. */}
          <div className="card mx-auto w-full max-w-md p-6 lg:justify-self-end">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-500">
              How escrow works
            </p>
            <ol className="mt-4 space-y-4">
              {[
                {
                  icon: Workflow,
                  title: "Client funds a milestone",
                  body: "The agreed amount is deposited into escrow before work starts — so the freelancer knows the money is real.",
                },
                {
                  icon: ShieldCheck,
                  title: "Freelancer delivers",
                  body: "Work is submitted for review. The funds stay locked — neither side can touch them — until the client decides.",
                },
                {
                  icon: Landmark,
                  title: "Approval releases payment",
                  body: "One click releases the escrowed amount. The 10% platform fee is deducted; the rest lands in the freelancer's wallet, instantly.",
                },
              ].map((step, i) => (
                <li key={step.title} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-white">
                      <step.icon size={16} />
                    </span>
                    {i < 2 ? <span className="mt-1 w-px flex-1 bg-ink-200" /> : null}
                  </div>
                  <div className={i < 2 ? "pb-4" : ""}>
                    <p className="font-semibold text-ink-900">{step.title}</p>
                    <p className="mt-1 text-sm text-ink-500">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
            <Link href="/docs" className="link mt-4 inline-flex items-center gap-1 text-sm">
              Read the full workflow <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------- categories */}
      <section className="container-page py-14">
        <SectionHeading
          title="Six categories, every specialism"
          action={
            <Link href="/projects" className="link text-sm">
              Explore all →
            </Link>
          }
        />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {categories.slice(0, 8).map((category) => (
            <Link
              key={category.id}
              href={`/projects?categoryId=${category.id}`}
              className="card group p-4 hover:border-brand-300"
            >
              <p className="font-semibold text-ink-900 group-hover:text-brand-700">
                {category.name}
              </p>
              <p className="mt-1 line-clamp-1 text-xs text-ink-500">{category.description}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------- featured projects */}
      <section className="border-y border-ink-100 bg-white py-14">
        <div className="container-page">
          <SectionHeading
            title="Work posted this week"
            action={
              <Link href="/projects" className="link text-sm">
                See {stats.projects.open} open projects →
              </Link>
            }
          />
          <div className="grid gap-4 md:grid-cols-3">
            {projects.items.map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="card group flex flex-col p-5"
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <StatusBadge status={project.status} />
                  <span className="text-sm font-semibold text-ink-900">
                    {formatBudget(
                      project.budgetMinCents,
                      project.budgetMaxCents,
                      project.budgetType,
                    )}
                  </span>
                </div>
                <h3 className="font-semibold text-ink-900 group-hover:text-brand-700">
                  {project.title}
                </h3>
                <p className="mt-2 line-clamp-3 flex-1 text-sm text-ink-500">
                  {excerpt(project.description, 160)}
                </p>
                <div className="mt-4 flex items-center justify-between border-t border-ink-100 pt-3 text-xs text-ink-500">
                  <span>{project.proposalsCount} proposals</span>
                  <span>{project.categoryName ?? "General"}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------ featured freelancers */}
      <section className="container-page py-14">
        <SectionHeading
          title="Top-rated specialists"
          action={
            <Link href="/freelancers" className="link text-sm">
              Browse the directory →
            </Link>
          }
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {freelancers.items.map((f) => (
            <Link key={f.profileId} href={`/freelancers/${f.profileId}`} className="card group p-5">
              <div className="flex items-center gap-3">
                <Avatar name={f.name} id={f.userId} />
                <div className="min-w-0">
                  <p className="truncate font-semibold text-ink-900 group-hover:text-brand-700">
                    {f.name}
                  </p>
                  <Stars rating={f.ratingAvg} count={f.ratingCount} />
                </div>
              </div>
              <p className="mt-3 line-clamp-2 min-h-10 text-sm text-ink-600">
                {f.headline ?? "Independent specialist"}
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {f.skills.slice(0, 3).map((skill) => (
                  <Badge key={skill}>{skill}</Badge>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-ink-100 pt-3 text-sm">
                <span className="font-semibold text-ink-900">
                  {f.hourlyRateCents != null
                    ? `${formatMoneyCompact(f.hourlyRateCents)}/hr`
                    : "Rate on request"}
                </span>
                <span className="text-xs text-ink-400">{f.completedContracts} contracts</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* --------------------------------------------------------------- CTA */}
      <section className="container-page pb-20">
        <div className="card overflow-hidden bg-brand-950 p-10 text-white sm:p-14">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-bold">Serious work deserves protected money.</h2>
            <p className="mt-3 text-brand-100">
              Free to join. Free to post. The 10% fee only applies when escrow is released — after
              you approve the delivery, never before.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/register" className="btn bg-white text-brand-950 hover:bg-brand-50">
                Create your account
                <ArrowRight size={16} />
              </Link>
              <Link
                href="/docs/architecture"
                className="btn border border-brand-400 text-white hover:bg-brand-900"
              >
                <Star size={16} />
                See how it&apos;s built
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function HeroStat(props: { label: string; value: string }) {
  return (
    <div>
      <dd className="text-2xl font-bold text-ink-950">{props.value}</dd>
      <dt className="mt-1 text-xs font-medium uppercase tracking-wide text-ink-500">
        {props.label}
      </dt>
    </div>
  );
}

function SectionHeading(props: { title: string; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex items-end justify-between">
      <h2 className="text-xl font-bold tracking-tight text-ink-950 sm:text-2xl">{props.title}</h2>
      {props.action}
    </div>
  );
}
