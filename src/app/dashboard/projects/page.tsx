import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/guards";
import { listClientProjects } from "@/server/services/project.service";
import { formatBudget } from "@/lib/money";
import { timeAgo } from "@/lib/utils";
import { PageHeader, StatusBadge, EmptyState, Card } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "My projects" };

export default async function MyProjectsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard/projects");
  if (user.role === "FREELANCER") redirect("/dashboard/proposals");

  const projects = await listClientProjects(user.id);

  return (
    <>
      <PageHeader
        title="My projects"
        description="Drafts are editable until published. Published projects accept proposals until you hire."
        actions={
          <Link href="/dashboard/projects/new" className="btn-primary">
            <Plus size={16} />
            New project
          </Link>
        }
      />

      {projects.length === 0 ? (
        <EmptyState
          title="Post your first project"
          description="Describe the work once — proposals with prices, timelines and cover letters will come to you."
          action={
            <Link href="/dashboard/projects/new" className="btn-primary btn-sm">
              Post a project
            </Link>
          }
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <table className="table-base">
            <thead>
              <tr>
                <th>Project</th>
                <th>Budget</th>
                <th>Proposals</th>
                <th>Status</th>
                <th className="hidden sm:table-cell">Posted</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => (
                <tr key={project.id} className="hover:bg-ink-50">
                  <td>
                    <Link
                      href={`/dashboard/projects/${project.id}`}
                      className="font-medium text-ink-900 hover:text-brand-700"
                    >
                      {project.title}
                    </Link>
                  </td>
                  <td className="tabular-nums">
                    {formatBudget(
                      project.budgetMinCents,
                      project.budgetMaxCents,
                      project.budgetType,
                    )}
                  </td>
                  <td>{project.proposalsCount}</td>
                  <td>
                    <StatusBadge status={project.status} />
                  </td>
                  <td className="hidden text-ink-500 sm:table-cell">
                    {timeAgo(project.publishedAt ?? project.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
