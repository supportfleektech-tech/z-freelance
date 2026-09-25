import Link from "next/link";
import { notFound } from "next/navigation";
import { getProjectDetail } from "@/server/services/project.service";
import { getCurrentUser } from "@/lib/auth/guards";
import { db as getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { formatBudget } from "@/lib/money";
import { formatDate, timeAgo } from "@/lib/utils";
import { Badge, StatusBadge, Stars, Card, CardHeader, MetaRow, Alert } from "@/components/ui";
import { ProposalForm } from "@/components/proposal-form";
import { StartThreadButton } from "@/components/thread-buttons";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const project = await getProjectDetail(id);
  return { title: project ? project.title : "Project" };
}

export default async function ProjectDetailPage({ params }: Props) {
  const { id } = await params;
  const user = await getCurrentUser();

  const project = await getProjectDetail(id, { viewerId: user?.id, countView: true });
  if (!project) notFound();

  const isOwner = user?.id === project.clientId;
  const isFreelancer = user?.role === "FREELANCER";

  let myProposalExists = false;
  if (isFreelancer && user) {
    const database = await getDb();
    const existing = await database
      .select({ id: schema.proposals.id })
      .from(schema.proposals)
      .where(eq(schema.proposals.projectId, project.id))
      .limit(1);
    myProposalExists = existing.length > 0;
  }

  return (
    <main className="container-page py-10">
      <nav className="mb-6 text-sm text-ink-500">
        <Link href="/projects" className="link">
          ← All projects
        </Link>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <article>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <StatusBadge status={project.status} />
            {project.categoryName ? <Badge tone="blue">{project.categoryName}</Badge> : null}
            <Badge tone="violet">{project.experienceLevel}</Badge>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-ink-950 sm:text-3xl">
            {project.title}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-500">
            <span>Posted {timeAgo(project.publishedAt)}</span>
            <span>·</span>
            <span>{project.proposalsCount} proposals</span>
            <span>·</span>
            <span>{project.viewsCount} views</span>
            {project.deadline ? (
              <>
                <span>·</span>
                <span>Deliver by {formatDate(project.deadline)}</span>
              </>
            ) : null}
          </div>

          <section className="mt-8">
            <h2 className="mb-3 text-lg font-semibold text-ink-900">Description</h2>
            <div className="prose max-w-none whitespace-pre-wrap text-sm leading-7 text-ink-700">
              {project.description}
            </div>
          </section>

          {project.skillNames.length > 0 ? (
            <section className="mt-8">
              <h2 className="mb-3 text-lg font-semibold text-ink-900">Skills required</h2>
              <div className="flex flex-wrap gap-2">
                {project.skillNames.map((skill) => (
                  <Badge key={skill} tone="blue">
                    {skill}
                  </Badge>
                ))}
              </div>
            </section>
          ) : null}
        </article>

        <aside className="space-y-4">
          <Card>
            <MetaRow
              cols={1}
              items={[
                {
                  label: "Budget",
                  value: `${formatBudget(project.budgetMinCents, project.budgetMaxCents, project.budgetType)} ${
                    project.budgetType === "HOURLY" ? "" : "· fixed price"
                  }`,
                },
                { label: "Escrow", value: "10% fee, only on released milestones" },
                { label: "Deadline", value: formatDate(project.deadline) },
              ]}
            />
          </Card>

          <Card>
            <CardHeader title="About the client" />
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 font-semibold text-brand-800">
                {project.clientName.slice(0, 1)}
              </div>
              <div>
                <p className="font-semibold text-ink-900">
                  {project.clientCompany ?? project.clientName}
                </p>
                <Stars rating={project.clientRating} />
              </div>
            </div>
            {!isOwner && project.status === "OPEN" && user ? (
              <div className="mt-4">
                <StartThreadButton projectId={project.id} label="Message the client" />
              </div>
            ) : null}
          </Card>

          {/* The action card changes with who is looking. */}
          {isOwner ? (
            <Card>
              <Alert tone="info">
                This is your project.{" "}
                <Link href={`/dashboard/projects/${project.id}`} className="link">
                  Open the proposals workspace →
                </Link>
              </Alert>
            </Card>
          ) : isFreelancer ? (
            project.status === "OPEN" ? (
              myProposalExists ? (
                <Card>
                  <Alert tone="success">
                    Your proposal is in. Track it under{" "}
                    <Link href="/dashboard/proposals" className="link">
                      My proposals
                    </Link>
                    .
                  </Alert>
                </Card>
              ) : (
                <Card>
                  <CardHeader
                    title="Submit a proposal"
                    description="Tell this client how you'd approach the work."
                  />
                  <ProposalForm projectId={project.id} />
                </Card>
              )
            ) : (
              <Card>
                <Alert>This project is no longer accepting proposals.</Alert>
              </Card>
            )
          ) : (
            <Card>
              <CardHeader title="Want to bid on this project?" />
              <p className="mb-4 text-sm text-ink-600">
                Create a free freelancer account to see the full brief and submit a proposal.
              </p>
              <Link href={`/register?next=/projects/${project.id}`} className="btn-primary w-full">
                Join as a freelancer
              </Link>
              {user == null ? (
                <p className="mt-3 text-center text-sm text-ink-500">
                  Already have an account?{" "}
                  <Link href="/login" className="link">
                    Sign in
                  </Link>
                </p>
              ) : null}
            </Card>
          )}
        </aside>
      </div>
    </main>
  );
}
