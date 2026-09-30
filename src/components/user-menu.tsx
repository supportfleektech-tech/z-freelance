"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { initials, avatarTone, humanize } from "@/lib/utils";
import { fetchJson } from "@/lib/api-client";

export function UserMenu(props: { name: string; email: string; role: string; id: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function logout() {
    try {
      await fetchJson("/api/auth/logout", { method: "POST" });
    } finally {
      setOpen(false);
      router.push("/");
      router.refresh();
    }
  }

  const links =
    props.role === "ADMIN"
      ? [
          { href: "/admin", label: "Admin console" },
          { href: "/admin/users", label: "Users" },
          { href: "/admin/disputes", label: "Disputes" },
          { href: "/admin/payouts", label: "Payouts" },
        ]
      : props.role === "FREELANCER"
        ? [
            { href: "/dashboard", label: "Overview" },
            { href: "/dashboard/proposals", label: "My proposals" },
            { href: "/dashboard/contracts", label: "Contracts" },
            { href: "/dashboard/earnings", label: "Earnings" },
            { href: "/dashboard/messages", label: "Messages" },
            { href: "/dashboard/profile", label: "Profile" },
          ]
        : [
            { href: "/dashboard", label: "Overview" },
            { href: "/dashboard/projects", label: "My projects" },
            { href: "/dashboard/contracts", label: "Contracts" },
            { href: "/dashboard/messages", label: "Messages" },
            { href: "/dashboard/profile", label: "Profile" },
          ];

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full p-1 pr-2 hover:bg-ink-100"
        aria-expanded={open}
        aria-label="Account menu"
      >
        <span
          className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold ${avatarTone(props.id)}`}
        >
          {initials(props.name)}
        </span>
      </button>

      {open ? (
        <div className="absolute right-0 mt-2 w-64 animate-fade-in rounded-xl border border-ink-200 bg-white shadow-pop">
          <div className="border-b border-ink-100 px-4 py-3">
            <p className="truncate text-sm font-semibold text-ink-900">{props.name}</p>
            <p className="truncate text-xs text-ink-500">{props.email}</p>
            <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-brand-600">
              {humanize(props.role)}
            </p>
          </div>
          <div className="py-1">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="block px-4 py-2 text-sm text-ink-700 hover:bg-ink-50"
              >
                {link.label}
              </Link>
            ))}
          </div>
          <div className="border-t border-ink-100 py-1">
            <button
              type="button"
              onClick={() => void logout()}
              className="block w-full px-4 py-2 text-left text-sm text-rose-700 hover:bg-rose-50"
            >
              Sign out
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
