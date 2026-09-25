/**
 * Seed a realistic demo dataset.
 *
 * Deliberately goes through the *real* service layer rather than raw inserts
 * for anything that touches money or workflow state. If the escrow pipeline is
 * broken, `npm run db:seed` fails loudly — the seed doubles as a smoke test of
 * the proposal -> contract -> escrow -> review lifecycle.
 *
 * Run with: npm run db:seed        (skips if already seeded)
 *           FORCE_SEED=1 npm run db:seed   (wipes and reseeds)
 */
import { eq, sql } from "drizzle-orm";
import { db as getDb } from "@/lib/db";
import { categories, milestones, skills, users, wallets } from "@/lib/db/schema";
import { hashPassword } from "@/lib/auth/password";
import { slugify } from "@/lib/utils";
import { registerUser } from "@/server/services/account.service";
import { createProject } from "@/server/services/project.service";
import { createProposal } from "@/server/services/proposal.service";
import {
  approveMilestone,
  fundMilestone,
  hireFromProposal,
  setMilestonePlan,
  submitWork,
} from "@/server/services/contract.service";
import { createReview } from "@/server/services/review.service";
import { updateFreelancerProfile, updateClientProfile } from "@/server/services/account.service";

const DEMO_PASSWORD = "Password123!";

const CATEGORY_SEED = [
  { name: "Web Development", description: "Sites, apps and APIs" },
  { name: "Mobile Development", description: "iOS and Android products" },
  { name: "Design", description: "Product, brand and UX design" },
  { name: "Data & AI", description: "Data engineering, ML and analytics" },
  { name: "DevOps & Cloud", description: "Infrastructure, CI/CD and SRE" },
  { name: "Writing", description: "Copy, content and technical writing" },
  { name: "Marketing", description: "Growth, SEO and paid media" },
  { name: "Video & Animation", description: "Motion, editing and 3D" },
] as const;

const SKILL_SEED: Record<string, string[]> = {
  "Web Development": ["TypeScript", "React", "Next.js", "Node.js", "PostgreSQL", "Tailwind CSS"],
  "Mobile Development": ["React Native", "Swift", "Kotlin", "Flutter"],
  Design: ["Figma", "UI Design", "UX Research", "Brand Identity"],
  "Data & AI": ["Python", "dbt", "Snowflake", "LLM Integration", "Airflow"],
  "DevOps & Cloud": ["AWS", "Docker", "Kubernetes", "Terraform"],
  Writing: ["Technical Writing", "SEO Copywriting", "Editing"],
  Marketing: ["SEO", "Paid Search", "Lifecycle Marketing"],
  "Video & Animation": ["After Effects", "Blender", "Video Editing"],
};

interface SeedPerson {
  name: string;
  email: string;
  role: "CLIENT" | "FREELANCER";
  headline?: string;
  bio?: string;
  rate?: number;
  country?: string;
  city?: string;
  years?: number;
  skillNames?: string[];
  company?: string;
}

const PEOPLE: SeedPerson[] = [
  {
    name: "Amara Okafor",
    email: "amara@northwind.io",
    role: "CLIENT",
    company: "Northwind Labs",
    bio: "We build developer tooling and hire specialists for focused sprints.",
    country: "United Kingdom",
    city: "London",
  },
  {
    name: "Diego Ramírez",
    email: "diego@fernandogoods.com",
    role: "CLIENT",
    company: "Fernando Goods",
    bio: "DTC retailer moving to a headless storefront.",
    country: "Spain",
    city: "Madrid",
  },
  {
    name: "Priya Raman",
    email: "priya@lumenhealth.org",
    role: "CLIENT",
    company: "Lumen Health",
    bio: "Non-profit health platform, HIPAA-aware engineering.",
    country: "United States",
    city: "Boston",
  },
  {
    name: "Tom Bakker",
    email: "tom@bakkeranalytics.nl",
    role: "CLIENT",
    company: "Bakker Analytics",
    bio: "Boutique analytics consultancy.",
    country: "Netherlands",
    city: "Utrecht",
  },
  {
    name: "Sofia Lindqvist",
    email: "sofia.freelance@example.com",
    role: "FREELANCER",
    headline: "Full-stack TypeScript engineer · Next.js specialist",
    bio: "I ship production Next.js apps end to end: design system, API, CI and observability. Ten years across fintech and health.",
    rate: 95,
    country: "Sweden",
    city: "Stockholm",
    years: 10,
    skillNames: ["TypeScript", "React", "Next.js", "PostgreSQL", "Tailwind CSS"],
  },
  {
    name: "Marcus Bell",
    email: "marcus.freelance@example.com",
    role: "FREELANCER",
    headline: "Platform engineer · AWS, Kubernetes, Terraform",
    bio: "I make deploys boring. Infrastructure as code, zero-downtime releases, sensible alerting.",
    rate: 120,
    country: "Canada",
    city: "Toronto",
    years: 12,
    skillNames: ["AWS", "Docker", "Kubernetes", "Terraform"],
  },
  {
    name: "Hana Yamada",
    email: "hana.freelance@example.com",
    role: "FREELANCER",
    headline: "Product designer · design systems and UX research",
    bio: "Research-led product designer. I turn messy problem spaces into interfaces people understand.",
    rate: 85,
    country: "Japan",
    city: "Tokyo",
    years: 8,
    skillNames: ["Figma", "UI Design", "UX Research"],
  },
  {
    name: "Luis Ferreira",
    email: "luis.freelance@example.com",
    role: "FREELANCER",
    headline: "Data engineer · dbt, Airflow, Snowflake",
    bio: "I build dependable data pipelines and the tests that keep them honest.",
    rate: 90,
    country: "Portugal",
    city: "Lisbon",
    years: 7,
    skillNames: ["Python", "dbt", "Snowflake", "Airflow"],
  },
  {
    name: "Grace Adeyemi",
    email: "grace.freelance@example.com",
    role: "FREELANCER",
    headline: "Mobile engineer · React Native & Swift",
    bio: "Cross-platform apps with native feel. App Store submissions, offline-first sync, CI.",
    rate: 80,
    country: "Nigeria",
    city: "Lagos",
    years: 6,
    skillNames: ["React Native", "Swift", "TypeScript"],
  },
  {
    name: "Noah Weinstein",
    email: "noah.freelance@example.com",
    role: "FREELANCER",
    headline: "Applied AI engineer · LLM integration & evals",
    bio: "I put language models into production with evaluation harnesses that catch regressions.",
    rate: 140,
    country: "United States",
    city: "Austin",
    years: 9,
    skillNames: ["Python", "LLM Integration", "TypeScript"],
  },
];

async function wipe(db: Awaited<ReturnType<typeof getDb>>): Promise<void> {
  console.log("[seed] FORCE_SEED set — clearing existing rows");
  await db.execute(sql`truncate table users restart identity cascade`);
  await db.execute(sql`truncate table categories, skills restart identity cascade`);
}

async function seed(): Promise<void> {
  const db = await getDb();

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`${users.email} = 'admin@zfreelance.dev'`)
    .limit(1);

  if (existing && !process.env.FORCE_SEED) {
    console.log("[seed] database already seeded — set FORCE_SEED=1 to reseed");
    return;
  }
  if (existing) await wipe(db);

  /* ------------------------------------------------------------ taxonomy */
  const categoryIdByName = new Map<string, string>();
  for (const category of CATEGORY_SEED) {
    const [row] = await db
      .insert(categories)
      .values({
        name: category.name,
        slug: slugify(category.name),
        description: category.description,
      })
      .onConflictDoNothing({ target: categories.slug })
      .returning();
    if (row) categoryIdByName.set(category.name, row.id);
  }
  // onConflictDoNothing returns no row when it already exists; re-read to be sure
  const allCategories = await db.select().from(categories);
  for (const row of allCategories) categoryIdByName.set(row.name, row.id);

  const skillIdByName = new Map<string, string>();
  for (const [, names] of Object.entries(SKILL_SEED)) {
    for (const name of names) {
      const [row] = await db
        .insert(skills)
        .values({ name, slug: slugify(name) })
        .onConflictDoNothing({ target: skills.slug })
        .returning();
      if (row) skillIdByName.set(name, row.id);
    }
  }
  const allSkills = await db.select().from(skills);
  for (const row of allSkills) skillIdByName.set(row.name, row.id);

  console.log(`[seed] taxonomy: ${categoryIdByName.size} categories, ${skillIdByName.size} skills`);

  /* --------------------------------------------------------------- admin */
  const adminHash = await hashPassword(DEMO_PASSWORD);
  await db.insert(users).values({
    email: "admin@zfreelance.dev",
    name: "Platform Admin",
    passwordHash: adminHash,
    role: "ADMIN",
  });

  /* --------------------------------------------------------------- users */
  const ids = new Map<string, string>();
  for (const person of PEOPLE) {
    const user = await registerUser({
      name: person.name,
      email: person.email,
      password: DEMO_PASSWORD,
      role: person.role,
    });
    ids.set(person.email, user.id);

    if (person.role === "FREELANCER") {
      await updateFreelancerProfile(user.id, {
        headline: person.headline,
        bio: person.bio,
        hourlyRateCents: person.rate != null ? Math.round(person.rate * 100) : null,
        country: person.country,
        city: person.city,
        yearsExperience: person.years,
        availability: "AVAILABLE",
        skills: person.skillNames ?? [],
      });
    } else {
      await updateClientProfile(user.id, {
        companyName: person.company,
        bio: person.bio,
        country: person.country,
        city: person.city,
      });
    }
  }
  console.log(`[seed] users: ${PEOPLE.length} marketplace accounts + 1 admin`);

  const id = (email: string): string => {
    const value = ids.get(email);
    if (!value) throw new Error(`seed: unknown person ${email}`);
    return value;
  };

  /* ------------------------------------------------------------ projects */
  const projectDefs = [
    {
      client: "amara@northwind.io",
      title: "Build a Next.js billing dashboard with usage-based invoicing",
      description:
        "We need a customer-facing billing dashboard built in Next.js and TypeScript. It must render real-time usage charts, allow plan changes, and download invoices as PDF. The API already exists; we need the front end, the server actions, and solid test coverage around the money paths.",
      category: "Web Development",
      skills: ["TypeScript", "React", "Next.js", "Tailwind CSS"],
      min: 8000,
      max: 12000,
      level: "EXPERT" as const,
    },
    {
      client: "diego@fernandogoods.com",
      title: "Migrate a Shopify storefront to a headless Next.js front end",
      description:
        "Our storefront is slow and hard to change. We want to move to a headless setup using the Shopify Storefront API, keeping SEO intact. Includes product listing, filtering, cart and checkout hand-off, plus a component library our team can extend.",
      category: "Web Development",
      skills: ["Next.js", "TypeScript", "React"],
      min: 12000,
      max: 18000,
      level: "INTERMEDIATE" as const,
    },
    {
      client: "priya@lumenhealth.org",
      title: "Design a patient intake flow that works on low-end Android",
      description:
        "Our intake form loses a third of patients on slow connections and small screens. We need research, wireframes, and a tested prototype. Deliverables: research summary, Figma prototype, and a handoff spec for our engineers.",
      category: "Design",
      skills: ["Figma", "UX Research", "UI Design"],
      min: 4000,
      max: 6500,
      level: "INTERMEDIATE" as const,
    },
    {
      client: "tom@bakkeranalytics.nl",
      title: "Stand up a dbt project with CI and data quality tests",
      description:
        "We have raw data in Snowflake and a pile of ad-hoc SQL. We want a proper dbt project: layered models, documented sources, generic and singular tests, and CI that fails on breaking changes. Training for two analysts included.",
      category: "Data & AI",
      skills: ["dbt", "Snowflake", "Python"],
      min: 6000,
      max: 9000,
      level: "INTERMEDIATE" as const,
    },
    {
      client: "amara@northwind.io",
      title: "Kubernetes migration with zero-downtime releases",
      description:
        "Move three services from ECS to EKS. Needs Terraform modules, Helm charts, progressive delivery, and rollback drills documented. We care most about not breaking production on a Friday.",
      category: "DevOps & Cloud",
      skills: ["Kubernetes", "Terraform", "AWS", "Docker"],
      min: 15000,
      max: 22000,
      level: "EXPERT" as const,
    },
    {
      client: "diego@fernandogoods.com",
      title: "React Native app for order tracking and returns",
      description:
        "Customers email us about orders constantly. We want a small app: order history, live tracking, and a returns flow with photo upload. Ship to both stores; we handle the accounts.",
      category: "Mobile Development",
      skills: ["React Native", "TypeScript"],
      min: 10000,
      max: 16000,
      level: "INTERMEDIATE" as const,
    },
    {
      client: "priya@lumenhealth.org",
      title: "LLM assistant for clinician note summarisation",
      description:
        "Prototype an assistant that summarises consultation notes into structured fields. Must include an evaluation harness with at least 100 labelled examples, prompt versioning, and a latency budget under three seconds.",
      category: "Data & AI",
      skills: ["LLM Integration", "Python"],
      min: 9000,
      max: 14000,
      level: "EXPERT" as const,
    },
    {
      client: "tom@bakkeranalytics.nl",
      title: "Technical documentation site for our analytics SDK",
      description:
        "Write and structure docs for a TypeScript SDK: quickstart, API reference generated from source, and three end-to-end guides. You will interview two engineers and review with a customer.",
      category: "Writing",
      skills: ["Technical Writing", "TypeScript"],
      min: 3000,
      max: 5000,
      level: "ENTRY" as const,
    },
  ];

  const projectIds: Array<{ id: string; title: string; client: string }> = [];
  for (const def of projectDefs) {
    const project = await createProject(id(def.client), {
      title: def.title,
      description: def.description,
      categoryId: categoryIdByName.get(def.category),
      budgetType: "FIXED",
      budgetMinCents: Math.round(def.min * 100),
      budgetMaxCents: Math.round(def.max * 100),
      experienceLevel: def.level,
      skills: def.skills,
      publish: true,
      deadline: new Date(Date.now() + 45 * 86_400_000),
    });
    projectIds.push({ id: project.id, title: project.title, client: def.client });
  }
  console.log(`[seed] projects: ${projectIds.length} published`);

  /* ----------------------------------------------------------- proposals */
  const proposalPlan: Array<{
    projectIndex: number;
    freelancer: string;
    bid: number;
    days: number;
    letter: string;
  }> = [
    {
      projectIndex: 0,
      freelancer: "sofia.freelance@example.com",
      bid: 10500,
      days: 21,
      letter:
        "I have built four usage-based billing UIs, two of them in Next.js App Router. My plan: week one on the invoice and usage data layer with server actions and integration tests; week two on charts and plan-change flows behind a feature flag; week three on PDF generation, empty states and accessibility. You get a component library your team can extend, plus tests around every money calculation.",
    },
    {
      projectIndex: 0,
      freelancer: "grace.freelance@example.com",
      bid: 9200,
      days: 25,
      letter:
        "Most of my work is React Native, but the underlying discipline is identical: typed data layers, optimistic UI, and tests on the paths where money moves. I would start by mapping your existing API contract into a typed client, then build the dashboard against that. Slightly longer timeline than others, but you get a strict contract layer that pays off later.",
    },
    {
      projectIndex: 1,
      freelancer: "sofia.freelance@example.com",
      bid: 15800,
      days: 30,
      letter:
        "Headless migrations live or die on SEO. I would audit your current URLs, build a redirect map, and ship route-by-route behind a traffic split so we can compare Core Web Vitals before and after. Cart and checkout hand-off stay on Shopify until the last step, which removes most of the risk.",
    },
    {
      projectIndex: 2,
      freelancer: "hana.freelance@example.com",
      bid: 5800,
      days: 18,
      letter:
        "Losing a third of patients at intake is a research problem before it is a design problem. I would run five contextual interviews, instrument the current funnel, then prototype three intake variants and test them on the actual low-end devices your patients use. You get evidence, not opinions.",
    },
    {
      projectIndex: 3,
      freelancer: "luis.freelance@example.com",
      bid: 7800,
      days: 24,
      letter:
        "I would structure the dbt project as staging, intermediate and marts, with sources documented and freshness tests wired to Airflow. CI runs dbt build plus a breaking-change check against a clone schema. The two analysts get a working session and a runbook so they own it after I leave.",
    },
    {
      projectIndex: 4,
      freelancer: "marcus.freelance@example.com",
      bid: 19500,
      days: 35,
      letter:
        "Three services, one cluster, zero drama. Terraform modules for the cluster and networking, Helm charts per service, Argo Rollouts for progressive delivery, and two rollback rehearsals scheduled during business hours with your on-call engineer. Documentation is a deliverable, not an afterthought.",
    },
    {
      projectIndex: 5,
      freelancer: "grace.freelance@example.com",
      bid: 13200,
      days: 28,
      letter:
        "I ship React Native apps to both stores monthly. For this I would use Expo with a dev build, offline-first order cache, and image uploads that survive flaky connections. Returns flow gets a state machine so every edge case is explicit and testable.",
    },
    {
      projectIndex: 6,
      freelancer: "noah.freelance@example.com",
      bid: 12600,
      days: 26,
      letter:
        "The evaluation harness comes first, not last. I would build 100 labelled notes, a scorer for each structured field, and a regression suite that runs in CI. Only then do we tune prompts and models. That order is what keeps quality from silently degrading six weeks after launch.",
    },
    {
      projectIndex: 7,
      freelancer: "noah.freelance@example.com",
      bid: 4200,
      days: 15,
      letter:
        "I write the docs for the SDKs I build, so I know where readers get stuck. Quickstart first, API reference generated from TSDoc so it cannot drift, then three guides that solve real problems end to end. I will interview your two engineers and validate the quickstart with one of your customers.",
    },
  ];

  const proposals: Array<{ proposalId: string; projectIndex: number; freelancer: string }> = [];
  for (const plan of proposalPlan) {
    const project = projectIds[plan.projectIndex];
    if (!project) throw new Error("seed: bad project index");
    const proposal = await createProposal(id(plan.freelancer), project.id, {
      coverLetter: plan.letter,
      bidAmountCents: Math.round(plan.bid * 100),
      estimatedDays: plan.days,
    });
    proposals.push({
      proposalId: proposal.id,
      projectIndex: plan.projectIndex,
      freelancer: plan.freelancer,
    });
  }
  console.log(`[seed] proposals: ${proposals.length} submitted`);

  /* -------------------------------------------- completed contract + reviews */
  const completed = proposals[0];
  if (!completed) throw new Error("seed: no proposals created");
  const completedClientEmail = projectIds[completed.projectIndex]?.client;
  if (!completedClientEmail) throw new Error("seed: missing client for completed contract");
  const completedClientId = id(completedClientEmail);
  const completedContract = await hireFromProposal(completed.proposalId, completedClientId);
  await setMilestonePlan(completedContract.id, completedClientId, [
    {
      title: "Data layer and server actions",
      amountCents: 4_000_00,
      description: "Typed client, invoice queries, integration tests.",
    },
    {
      title: "Dashboard UI and charts",
      amountCents: 4_000_00,
      description: "Usage charts, plan changes, design system.",
    },
    {
      title: "Invoicing PDF and polish",
      amountCents: 2_500_00,
      description: "PDF generation, empty states, accessibility pass.",
    },
  ]);

  const completedMilestones = await fundSubmitApprove(
    completedContract.id,
    completedClientId,
    id(completed.freelancer),
  );
  console.log(`[seed] contract complete: ${completedMilestones} milestones released`);

  await createReview(completedClientId, {
    contractId: completedContract.id,
    rating: 5,
    comment:
      "Sofia shipped ahead of schedule and the money paths came with tests, which is rare. Communication was excellent — weekly written updates, no surprises.",
  });
  await createReview(id(completed.freelancer), {
    contractId: completedContract.id,
    rating: 5,
    comment:
      "Clear scope, fast feedback, escrow funded on day one. Would work with Northwind again.",
  });

  /* --------------------------------------------- in-flight contract (escrow) */
  const inFlight = proposals[3];
  if (!inFlight) throw new Error("seed: missing in-flight proposal");
  const inFlightContract = await hireFromProposal(inFlight.proposalId, id("priya@lumenhealth.org"));
  await setMilestonePlan(inFlightContract.id, id("priya@lumenhealth.org"), [
    { title: "Research and funnel audit", amountCents: 2_500_00 },
    { title: "Prototype and usability testing", amountCents: 3_300_00 },
  ]);

  const planMilestones = await listMilestones(inFlightContract.id);
  const first = planMilestones[0];
  const second = planMilestones[1];
  if (!first || !second) throw new Error("seed: milestone plan not created");

  // Milestone 1: funded, delivered and paid.
  await fundMilestone(first.id, id("priya@lumenhealth.org"));
  await submitWork(
    first.id,
    id(inFlight.freelancer),
    "Research summary and funnel audit attached — 5 interviews, three drop-off causes identified.",
  );
  await approveMilestone(first.id, id("priya@lumenhealth.org"));

  // Milestone 2: funded and awaiting review — shows the escrow state in the UI.
  await fundMilestone(second.id, id("priya@lumenhealth.org"));
  await submitWork(
    second.id,
    id(inFlight.freelancer),
    "Prototype ready for review; usability sessions scheduled with six participants.",
  );
  console.log("[seed] in-flight contract: one milestone released, one awaiting client review");

  /* -------------------------------------------------------- wallet balances */
  const walletRows = await db.select().from(wallets);
  const funded = walletRows.filter((w) => w.balanceCents > 0);
  console.log(`[seed] wallets: ${funded.length} with a positive balance`);

  console.log("");
  console.log("[seed] done. Sign in with any of:");
  console.log("  admin@zfreelance.dev            / Password123!  (admin)");
  console.log("  amara@northwind.io              / Password123!  (client)");
  console.log("  sofia.freelance@example.com     / Password123!  (freelancer)");
}

/** Drive a whole contract to completion through the real escrow state machine. */
async function fundSubmitApprove(
  contractId: string,
  clientId: string,
  freelancerId: string,
): Promise<number> {
  const rows = await listMilestones(contractId);
  for (const milestone of rows) {
    await fundMilestone(milestone.id, clientId);
    await submitWork(
      milestone.id,
      freelancerId,
      `Deliverable for “${milestone.title}” is ready for review.`,
    );
    await approveMilestone(milestone.id, clientId);
  }
  return rows.length;
}

async function listMilestones(contractId: string) {
  const database = await getDb();
  return database
    .select()
    .from(milestones)
    .where(eq(milestones.contractId, contractId))
    .orderBy(milestones.position);
}

seed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("[seed] failed:", error);
    process.exit(1);
  });
