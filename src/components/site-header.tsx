import Link from "next/link";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth/guards";
import { listNotifications } from "@/server/services/notification.service";
import { db as getDb } from "@/lib/db";
import { NotificationBell } from "./notification-bell";
import { UserMenu } from "./user-menu";

export function LogoMark({ size = "md" }: { size?: "md" | "sm" }) {
  const dim = size === "md" ? "h-9 w-9 rounded-[10px] text-base" : "h-8 w-8 rounded-lg text-sm";
  return (
    <span
      className={`flex items-center justify-center bg-gradient-to-br from-brand-500 via-brand-600 to-brand-800 font-display font-black text-white shadow-glow transition-transform duration-300 group-hover:rotate-[-6deg] group-hover:scale-105 ${dim}`}
      aria-hidden
    >
      z
    </span>
  );
}

export async function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-ink-200/60 bg-ink-50/80 backdrop-blur-md supports-[backdrop-filter]:bg-ink-50/60">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <div className="flex items-center gap-8">
          <Link href="/" className="group flex items-center gap-2.5">
            <LogoMark />
            <span className="hidden font-display text-lg font-black tracking-tight text-ink-950 sm:inline">
              z&#8209;freelance
            </span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
            <NavLink href="/projects" label="Find work" />
            <NavLink href="/freelancers" label="Hire talent" />
            <NavLink href="/docs" label="How it works" />
          </nav>
        </div>

        <Suspense fallback={<div className="h-8 w-24 animate-pulse rounded-lg bg-ink-100" />}>
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
      className="group relative rounded-lg px-3 py-2 text-sm font-semibold text-ink-600 transition-colors hover:text-ink-950"
    >
      {props.label}
      <span
        aria-hidden
        className="absolute inset-x-3 bottom-1 h-0.5 origin-left scale-x-0 rounded-full bg-gradient-to-r from-brand-500 to-amber-400 transition-transform duration-300 group-hover:scale-x-100"
      />
    </Link>
  );
}
