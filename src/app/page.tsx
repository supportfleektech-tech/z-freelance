import Link from "next/link";
import { ArrowRight, Workflow, ShieldCheck, Landmark, Star, Quote, CirclePlay } from "lucide-react";
import { platformStats } from "@/server/services/admin.service";
import { listCategories } from "@/server/services/taxonomy.service";
import { searchFreelancers } from "@/server/services/freelancer.service";
import { searchProjects } from "@/server/services/project.service";
import { db as getDb } from "@/lib/db";
import { formatMoneyCompact, formatBudget } from "@/lib/money";
import { Badge, Avatar, Stars, StatusBadge } from "@/components/ui";
import { Reveal, TypeWriter } from "@/components/motion";
import { LandingHero } from "@/components/landing/hero";
import { TourPlayer } from "@/components/landing/tour";
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
      <LandingHero
        freelancerCount={stats.users.freelancers}
        openProjects={stats.projects.open}
        paidVolume={formatMoneyCompact(stats.money.grossVolumeCents)}
      />

      {/* ---------------------------------------------- category marquees */}
      <section className="overflow-hidden border-b border-ink-200/60 bg-white py-6">
        <MarqueeRow categories={categories} offset={0} />
        <MarqueeRow categories={[...categories].reverse()} offset={1} reverse />
      </section>

      {/* -------------------------------------------------- how it works */}
      <section className="container-page noise relative py-20">
        <Reveal>
          <div className="mx-auto max-w-2xl text-center">
            <p className="eyebrow">The escrow flow</p>
            <h2 className="mt-3 text-balance font-display text-3xl font-black tracking-tight text-ink-950 sm:text-4xl">
              Money that jumps through
              <span className="gradient-text"> one hoop</span>, not the other
            </h2>
            <p className="mt-3 text-ink-600">
              Three clicks separate &ldquo;hired&rdquo; from &ldquo;paid&rdquo; — and the money is
              protected at every step, on both sides of the deal.
            </p>
          </div>
        </Reveal>

        <ol className="relative mt-14 grid gap-6 md:grid-cols-3">
          {/* connector */}
          <div
            aria-hidden
            className="absolute left-[10%] right-[10%] top-10 hidden border-t-2 border-dashed border-brand-200 md:block"
          />
          {[
            {
              icon: Workflow,
              step: "01",
              title: "Fund before work starts",
              body: "The client deposits the milestone into escrow. The freelancer sees the money is real and gets to work with confidence.",
              tone: "from-brand-500 to-brand-700",
            },
            {
              icon: ShieldCheck,
              step: "02",
              title: "Deliver while it's locked",
              body: "Work is submitted for review. Neither side can touch the funds — disputes are resolved by a human admin, not a bot.",
              tone: "from-amber-400 to-amber-600",
            },
            {
              icon: Landmark,
              step: "03",
              title: "Release the moment it lands",
              body: "One approval and the escrow opens instantly: 90% to the freelancer's wallet, 10% platform fee. That's the whole fee, ever.",
              tone: "from-emerald-500 to-brand-700",
            },
          ].map((step, i) => (
            <Reveal key={step.title} delay={i * 130}>
              <li className="card card-hover relative h-full p-6">
                <div className="flex items-center justify-between">
                  <span
                    className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-pop ${step.tone}`}
                  >
                    <step.icon size={20} />
                  </span>
                  <span className="font-display text-3xl font-black text-ink-100">{step.step}</span>
                </div>
                <h3 className="mt-4 text-lg font-bold text-ink-950">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-600">{step.body}</p>
              </li>
            </Reveal>
          ))}
        </ol>

        <Reveal delay={420}>
          <div className="mt-8 text-center">
            <Link href="/docs" className="link text-sm">
              Read the full workflow <ArrowRight size={14} className="inline" />
            </Link>
          </div>
        </Reveal>
      </section>

      {/* ----------------------------------------------- the tutorial */}
      <section className="relative overflow-hidden border-y border-ink-200/60 bg-white py-20">
        <div className="aurora-blob -left-24 top-1/3 h-80 w-80 bg-brand-200/50" />
        <div className="aurora-blob -right-24 bottom-0 h-80 w-80 bg-amber-200/50" />
        <div className="container-page relative grid items-center gap-12 lg:grid-cols-[0.9fr_1.1fr]">
          <Reveal>
            <div>
              <p className="eyebrow flex items-center gap-2">
                <CirclePlay size={14} />
                The 60-second tour
              </p>
              <h2 className="mt-3 text-balance font-display text-3xl font-black tracking-tight text-ink-950 sm:text-4xl">
                See the whole deal, start to payout, in one minute
              </h2>
              <p className="mt-4 max-w-md leading-relaxed text-ink-600">
                Five scenes — posting, funding, delivery, release, payout — animated exactly as they
                happen in the product. No sign-up, no sound required, and every control works with
                keyboard and reduced-motion settings too.
              </p>
              <ul className="mt-6 space-y-3">
                {[
                  "Funds locked before work starts — never a leap of faith",
                  "Humans resolve disputes; bots never touch your money",
                  "A double-entry ledger records every cent, forever",
                ].map((point, i) => (
                  <Reveal key={point} delay={150 + i * 120}>
                    <li className="flex items-start gap-3 text-sm text-ink-700">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-600 text-[10px] font-black text-white">
                        ✓
                      </span>
                      {point}
                    </li>
                  </Reveal>
                ))}
              </ul>
            </div>
          </Reveal>
          <Reveal delay={150}>
            <TourPlayer />
          </Reveal>
        </div>
      </section>

      {/* ------------------------------------------------- featured projects */}
      <section className="container-page py-20">
        <Reveal>
          <SectionHeading
            eyebrow="Fresh off the wire"
            title="Work posted this week"
            action={
              <Link href="/projects" className="link text-sm">
                See all {stats.projects.open} open projects →
              </Link>
            }
          />
        </Reveal>
        <div className="grid gap-5 md:grid-cols-3">
          {projects.items.map((project, i) => (
            <Reveal key={project.id} delay={i * 120}>
              <Link
                href={`/projects/${project.id}`}
                className="card card-hover group flex h-full flex-col p-5"
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <StatusBadge status={project.status} />
                  <span className="text-sm font-bold text-brand-700">
                    {formatBudget(
                      project.budgetMinCents,
                      project.budgetMaxCents,
                      project.budgetType,
                    )}
                  </span>
                </div>
                <h3 className="font-bold text-ink-950 transition-colors group-hover:text-brand-700">
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
            </Reveal>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------ featured freelancers */}
      <section className="border-y border-ink-200/60 bg-white py-20">
        <div className="container-page">
          <Reveal>
            <SectionHeading
              eyebrow="Vetted specialists"
              title="Top-rated this quarter"
              action={
                <Link href="/freelancers" className="link text-sm">
                  Browse the directory →
                </Link>
              }
            />
          </Reveal>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {freelancers.items.map((f, i) => (
              <Reveal key={f.profileId} delay={i * 110}>
                <Link
                  href={`/freelancers/${f.profileId}`}
                  className="card card-hover group block h-full p-5"
                >
                  <div className="flex items-center gap-3">
                    <Avatar name={f.name} id={f.userId} />
                    <div className="min-w-0">
                      <p className="truncate font-bold text-ink-950 transition-colors group-hover:text-brand-700">
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
                    <span className="font-bold text-ink-950">
                      {f.hourlyRateCents != null
                        ? `${formatMoneyCompact(f.hourlyRateCents)}/hr`
                        : "Rate on request"}
                    </span>
                    <span className="text-xs text-ink-400">{f.completedContracts} contracts</span>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------- testimonials */}
      <section className="container-page noise relative py-20">
        <Reveal>
          <div className="mx-auto max-w-2xl text-center">
            <p className="eyebrow">Word on the street</p>
            <h2 className="mt-3 text-balance font-display text-3xl font-black tracking-tight text-ink-950 sm:text-4xl">
              Clients sleep better. Freelancers eat better.
            </h2>
          </div>
        </Reveal>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {[
            {
              quote:
                "I funded the whole design system milestone and never thought about the money again. Approval day, one click, done.",
              name: "Amara Ochieng",
              role: "Head of Product · Northwind Studio",
              seed: "amara-t",
            },
            {
              quote:
                "Escrow means I start work on day one. Zero invoicing anxiety — the ledger shows every cent, and the payout took minutes.",
              name: "Lena Kowalska",
              role: "Mobile engineer · 5.0 across 23 contracts",
              seed: "lena-t",
            },
            {
              quote:
                "We moved three agencies worth of work here. The fee is honest, the disputes are handled by humans, and the audit trail makes finance happy.",
              name: "Priya Raman",
              role: "Operations Director · Lumen Health",
              seed: "priya-t",
            },
          ].map((t, i) => (
            <Reveal key={t.name} delay={i * 130}>
              <figure className="card card-hover relative h-full p-6">
                <Quote size={28} className="text-amber-400" aria-hidden fill="currentColor" />
                <blockquote className="mt-3 text-sm leading-relaxed text-ink-700">
                  &ldquo;{t.quote}&rdquo;
                </blockquote>
                <figcaption className="mt-5 flex items-center gap-3 border-t border-ink-100 pt-4">
                  <Avatar name={t.name} id={t.seed} />
                  <div>
                    <p className="text-sm font-bold text-ink-950">{t.name}</p>
                    <p className="text-xs text-ink-500">{t.role}</p>
                  </div>
                </figcaption>
                <div className="absolute right-5 top-5">
                  <Stars rating={5} size={12} />
                </div>
              </figure>
            </Reveal>
          ))}
        </div>
      </section>

      {/* --------------------------------------------------------------- CTA */}
      <section className="container-page pb-24">
        <Reveal>
          <div className="noise relative overflow-hidden rounded-3xl bg-brand-950 p-10 text-white sm:p-16">
            <div className="aurora-blob -left-20 -top-24 h-80 w-80 animate-aurora bg-brand-500/40" />
            <div className="aurora-blob -bottom-24 -right-16 h-80 w-80 animate-aurora bg-amber-400/25 [animation-delay:-8s]" />
            <div className="grid-pattern absolute inset-0 opacity-30" />
            <div className="relative max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-300">
                Free to join · free to post
              </p>
              <h2 className="mt-4 text-balance font-display text-3xl font-black tracking-tight sm:text-5xl">
                <TypeWriter
                  phrases={["Serious work,", "serious money,", "protected by escrow."]}
                  typeMs={55}
                />
              </h2>
              <p className="mt-4 max-w-xl leading-relaxed text-brand-100">
                The 10% fee applies only when escrow is released — after delivery is approved, never
                before. Everything else is free: posting, proposals, messaging, dispute support.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/register" className="btn-gold btn-lg">
                  Create your account
                  <ArrowRight size={18} />
                </Link>
                <Link
                  href="/docs/architecture"
                  className="btn border border-brand-400/60 text-white hover:border-amber-300 hover:bg-brand-900"
                >
                  <Star size={16} />
                  See how it&apos;s built
                </Link>
              </div>
            </div>
          </div>
        </Reveal>
      </section>
    </main>
  );
}

function SectionHeading(props: { eyebrow?: string; title: string; action?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        {props.eyebrow ? <p className="eyebrow">{props.eyebrow}</p> : null}
        <h2 className="mt-2 font-display text-2xl font-black tracking-tight text-ink-950 sm:text-3xl">
          {props.title}
        </h2>
      </div>
      {props.action}
    </div>
  );
}

function MarqueeRow({
  categories,
  offset,
  reverse = false,
}: {
  categories: Array<{ id: string; name: string; description: string | null }>;
  offset: number;
  reverse?: boolean;
}) {
  const items = [...categories, ...categories];
  return (
    <div className="relative overflow-hidden py-2 [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
      <div
        className={`marquee-track ${reverse ? "reverse" : ""} flex w-max items-center gap-3 px-2`}
        style={{ ["--marquee-duration" as string]: `${reverse ? 46 : 34}s` }}
      >
        {items.map((category, i) => (
          <Link
            key={`${category.id}-${i}`}
            href={`/projects?categoryId=${category.id}`}
            aria-hidden={i >= categories.length}
            tabIndex={i >= categories.length ? -1 : 0}
            className="whitespace-nowrap rounded-full border border-ink-200 bg-ink-50/60 px-5 py-2 text-sm font-semibold text-ink-700 transition-all hover:-translate-y-0.5 hover:border-brand-400 hover:bg-brand-50 hover:text-brand-800 hover:shadow-pop"
          >
            {offset === 0 ? category.name : `✦ ${category.name}`}
          </Link>
        ))}
      </div>
    </div>
  );
}
