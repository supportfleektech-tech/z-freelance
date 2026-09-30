import Link from "next/link";
import { redirect } from "next/navigation";
import {
  LayoutDashboard,
  Briefcase,
  Bookmark,
  FileText,
  Handshake,
  Settings as SettingsIcon,
  Wallet,
  MessageSquare,
  User as UserIcon,
  Star,
} from "lucide-react";
import { getCurrentUser } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

const NAV_BY_ROLE = {
  CLIENT: [
    { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
    { href: "/dashboard/projects", label: "My projects", icon: Briefcase },
    { href: "/dashboard/contracts", label: "Contracts", icon: Handshake },
    { href: "/dashboard/messages", label: "Messages", icon: MessageSquare },
    { href: "/dashboard/reviews", label: "Reviews", icon: Star },
    { href: "/dashboard/profile", label: "Profile", icon: UserIcon },
    { href: "/dashboard/settings", label: "Settings", icon: SettingsIcon },
  ],
  FREELANCER: [
    { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
    { href: "/dashboard/proposals", label: "My proposals", icon: FileText },
    { href: "/dashboard/saved", label: "Saved projects", icon: Bookmark },
    { href: "/dashboard/contracts", label: "Contracts", icon: Handshake },
    { href: "/dashboard/earnings", label: "Earnings", icon: Wallet },
    { href: "/dashboard/messages", label: "Messages", icon: MessageSquare },
    { href: "/dashboard/reviews", label: "Reviews", icon: Star },
    { href: "/dashboard/profile", label: "Profile", icon: UserIcon },
    { href: "/dashboard/settings", label: "Settings", icon: SettingsIcon },
  ],
  ADMIN: [
    { href: "/admin", label: "Admin console", icon: LayoutDashboard },
    { href: "/admin/users", label: "Users", icon: UserIcon },
    { href: "/admin/disputes", label: "Disputes", icon: Handshake },
    { href: "/admin/payouts", label: "Payouts", icon: Wallet },
  ],
} as const;

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard");
  if (user.role === "ADMIN") redirect("/admin");

  const nav = NAV_BY_ROLE[user.role];

  return (
    <div className="container-page grid gap-8 py-10 lg:grid-cols-[220px_1fr]">
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <nav className="card flex gap-1 overflow-x-auto p-2 lg:flex-col" aria-label="Workspace">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-ink-600 hover:bg-ink-50 hover:text-ink-950"
            >
              <item.icon size={16} className="text-ink-400" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-4 hidden rounded-xl border border-brand-100 bg-brand-50 p-4 lg:block">
          <p className="text-sm font-semibold text-brand-900">Money stays in escrow</p>
          <p className="mt-1 text-xs leading-5 text-brand-800">
            {user.role === "CLIENT"
              ? "Funded milestones are locked until you approve — or an admin resolves a dispute."
              : "Client deposits are real and locked the moment a milestone is funded. Deliver, and payment is one click away."}
          </p>
        </div>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
