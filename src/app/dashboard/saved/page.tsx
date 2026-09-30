import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guards";
import { listSavedProjects } from "@/server/services/saved-projects.service";
import { formatBudget } from "@/lib/money";
import { formatDate, timeAgo } from "@/lib/utils";
import { Badge, Card, EmptyState, PageHeader, StatusBadge } from "@/components/ui";
import { SaveProjectButton } from "@/components/save-project-button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Saved projects" };

export default async function SavedProjectsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard/saved");
  if (user.role !== "FREELANCER") redirect("/dashboard");

  const items = await listSavedProjects(user.id);

  return (
    <>
      <PageHeader
        title="Saved projects"
        description="Projects you bookmarked to bid on later. Clients can't see your list."
      />

      {items.length === 0 ? (
        <EmptyState
          title="Nothing saved yet"
          description="Browse open projects and tap the bookmark to keep the interesting ones here."
          action={
            <Link href="/projects" className="btn-primary btn-sm">
              Browse projects
            </Link>
          }
        />
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <Card key={item.savedId}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={item.status} />
                    {item.categoryName ? <Badge tone="blue">{item.categoryName}</Badge> : null}
                  </div>
                  <Link
                    href={`/projects/${item.projectId}`}
                    className="mt-2 block text-base font-semibold text-ink-950 hover:text-brand-700"
                  >
                    {item.title}
                  </Link>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-500">
                    <span>{item.clientCompany ?? item.clientName}</span>
                    <span>
                      {formatBudget(
                        item.budgetMinCents,
                        item.budgetMaxCents,
                        item.budgetType === "HOURLY" ? "HOURLY" : "FIXED",
                      )}
                    </span>
                    <span>{item.proposalsCount} proposals</span>
                    <span>Saved {timeAgo(item.savedAt)}</span>
                    {item.deadline ? <span>Deliver by {formatDate(item.deadline)}</span> : null}
                  </div>
                  {item.skillNames.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {item.skillNames.map((name) => (
                        <Badge key={name} tone="violet">
                          {name}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <SaveProjectButton projectId={item.projectId} initialSaved variant="card" />
                  <Link href={`/projects/${item.projectId}`} className="btn-primary btn-sm">
                    View &amp; bid
                  </Link>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
