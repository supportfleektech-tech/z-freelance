import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guards";
import { listCategories } from "@/server/services/taxonomy.service";
import { db as getDb } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { PostProjectForm } from "@/components/post-project-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Post a project" };

export default async function NewProjectPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard/projects/new");
  if (user.role === "FREELANCER") redirect("/dashboard/proposals");

  const categories = await listCategories(await getDb());

  return (
    <>
      <PageHeader
        title="Post a project"
        description="Be specific about outcomes, constraints and budget — clear briefs get better proposals, faster."
      />
      <PostProjectForm categories={categories} />
    </>
  );
}
