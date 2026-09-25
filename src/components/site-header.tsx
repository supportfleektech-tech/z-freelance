import Link from "next/link";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth/guards";
import { listNotifications } from "@/server/services/notification.service";
import { db as getDb } from "@/lib/db";
import { NotificationBell } from "./notification-bell";
import { UserMenu } from "./user-menu";

export async function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-ink-100 bg-white/90 backdrop-blur">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2 text-lg font-bold text-ink-950">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
              z
            </span>
            <span className="hidden sm:inline">z&#8209;freelance</span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
            <NavLink href="/projects" label="Find work" />
            <NavLink href="/freelancers" label="Hire talent" />
            <NavLink href="/docs" label="How it works" />
          </nav>
        </div>

        <Suspense fallback={<div className="h-8 w-24 animate-pulse rounded bg-ink-100" />}>
          <AccountSection />
        </Suspense>
      </div>
    </header>
  );
}

async function AccountSection() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <Link href="/login" className="btn-ghost btn-sm">
          Sign in
        </Link>
        <Link href="/register" className="btn-primary btn-sm">
          Get started
        </Link>
      </div>
    );
  }

  let unread = 0;
  try {
    const database = await getDb();
    unread = (await listNotifications(database, user.id, { pageSize: 1 })).unread;
  } catch {
    // Notifications are not critical path for the header.
  }

  const links =
    user.role === "ADMIN"
      ? [
          { href: "/admin", label: "Admin" },
          { href: "/dashboard", label: "Dashboard" },
        ]
      : [{ href: "/dashboard", label: "Dashboard" }];

  return (
    <div className="flex items-center gap-2">
      {links.map((link) => (
        <Link key={link.href} href={link.href} className="btn-ghost btn-sm hidden sm:inline-flex">
          {link.label}
        </Link>
      ))}
      <NotificationBell initialUnread={unread} />
      <UserMenu name={user.name} email={user.email} role={user.role} id={user.id} />
    </div>
  );
}

function NavLink(props: { href: string; label: string }) {
  return (
    <Link
      href={props.href}
      className="rounded-lg px-3 py-2 text-sm font-medium text-ink-600 hover:bg-ink-50 hover:text-ink-950"
    >
      {props.label}
    </Link>
  );
}
