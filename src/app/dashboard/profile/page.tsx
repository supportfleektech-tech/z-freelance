import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guards";
import { getProfileBundle } from "@/server/services/account.service";
import { PageHeader, Card, CardHeader } from "@/components/ui";
import { ProfileForm } from "@/components/profile-form";
import { PasswordForm } from "@/components/password-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Profile" };

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard/profile");

  const bundle = await getProfileBundle(user.id);

  return (
    <>
      <PageHeader
        title="Profile"
        description="What the marketplace sees about you — and your account security."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Card>
          <CardHeader
            title={user.role === "FREELANCER" ? "Freelancer profile" : "Hiring profile"}
            description="Keep details current — they're shown to the people deciding whether to work with you."
          />
          <ProfileForm
            role={user.role}
            freelancer={bundle?.freelancer ?? null}
            client={bundle?.client ?? null}
          />
        </Card>

        <Card className="h-fit">
          <CardHeader title="Change password" />
          <PasswordForm />
        </Card>
      </div>
    </>
  );
}
