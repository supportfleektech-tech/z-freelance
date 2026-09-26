import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guards";
import { getNotificationPrefs } from "@/server/services/notification.service";
import { Card, CardHeader, PageHeader } from "@/components/ui";
import { NotificationPrefsForm } from "@/components/notification-prefs-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard/settings");

  const prefs = await getNotificationPrefs(user.id);

  return (
    <>
      <PageHeader
        title="Settings"
        description="Notification delivery preferences for your account."
      />

      <Card>
        <CardHeader
          title="Notifications"
          description="Choose which events create in-app notifications. Everything is on by default; security-critical account notices are always attempted."
        />
        <NotificationPrefsForm initialPrefs={prefs} />
      </Card>
    </>
  );
}
