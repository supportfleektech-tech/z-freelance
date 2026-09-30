"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { fetchJson } from "@/lib/api-client";
import { timeAgo } from "@/lib/utils";

interface NotificationItem {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

interface Feed {
  items: NotificationItem[];
  unread: number;
}

/**
 * Header bell: shows the unread count and a dropdown of recent items.
 * Polls every 30s so fresh events appear without a refresh.
 */
export function NotificationBell({ initialUnread }: { initialUnread: number }) {
  const [open, setOpen] = useState(false);
  const [feed, setFeed] = useState<Feed | null>(null);
  const [unread, setUnread] = useState(initialUnread);
  const ref = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    try {
      const { data } = await fetchJson<Feed>("/api/notifications?pageSize=8");
      setFeed(data);
      setUnread(data.unread);
    } catch {
      // Keep the previous state on transient failures.
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), 30_000);
    return () => clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function markAllRead() {
    try {
      await fetchJson("/api/notifications/read", {
        method: "POST",
        body: JSON.stringify({ all: true }),
      });
      await refresh();
    } catch {
      // ignore
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          if (!open) void refresh();
        }}
        className="relative rounded-lg p-2 text-ink-600 hover:bg-ink-100"
        aria-label={`Notifications${unread > 0 ? `, ${unread} unread` : ""}`}
        aria-expanded={open}
      >
        <Bell size={18} />
        {unread > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 mt-2 w-80 animate-fade-in rounded-xl border border-ink-200 bg-white shadow-pop">
          <div className="flex items-center justify-between border-b border-ink-100 px-4 py-2.5">
            <p className="text-sm font-semibold text-ink-900">Notifications</p>
            <button
              type="button"
              onClick={() => void markAllRead()}
              className="text-xs font-medium text-brand-700 hover:underline"
            >
              Mark all read
            </button>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {!feed || feed.items.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-ink-500">
                You&apos;re all caught up.
              </p>
            ) : (
              feed.items.map((n) => (
                <Link
                  key={n.id}
                  href={n.link ?? "/dashboard"}
                  onClick={() => setOpen(false)}
                  className={`block border-b border-ink-50 px-4 py-3 hover:bg-ink-50 ${n.readAt ? "opacity-70" : ""}`}
                >
                  <p className="text-sm font-medium text-ink-900">{n.title}</p>
                  {n.body ? (
                    <p className="mt-0.5 line-clamp-2 text-xs text-ink-500">{n.body}</p>
                  ) : null}
                  <p className="mt-1 text-[11px] text-ink-400">{timeAgo(n.createdAt)}</p>
                </Link>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
