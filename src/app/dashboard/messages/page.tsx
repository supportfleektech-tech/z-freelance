import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth/guards";
import { listThreads } from "@/server/services/messaging.service";
import { excerpt, timeAgo } from "@/lib/utils";
import { PageHeader, EmptyState, Avatar, Badge } from "@/components/ui";
import { ThreadView } from "@/components/thread-view";

export const dynamic = "force-dynamic";
export const metadata = { title: "Messages" };

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ thread?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard/messages");

  const threads = await listThreads(user.id);
  const { thread: activeId } = await searchParams;
  const active = threads.find((t) => t.id === activeId) ?? threads[0];

  return (
    <>
      <PageHeader
        title="Messages"
        description="Every conversation is tied to a proposal, project or contract — context is never lost."
      />

      {threads.length === 0 ? (
        <EmptyState
          title="No conversations yet"
          description="Messages open automatically when you hire, bid, or click “Message” on a workspace page."
          action={
            <Link href="/projects" className="btn-primary btn-sm">
              Browse the marketplace
            </Link>
          }
        />
      ) : (
        <div
          className="card grid overflow-hidden lg:grid-cols-[320px_1fr]"
          style={{ minHeight: 480 }}
        >
          {/* thread list */}
          <div className="border-b border-ink-100 lg:border-b-0 lg:border-r">
            {threads.map((t) => (
              <Link
                key={t.id}
                href={`/dashboard/messages?thread=${t.id}`}
                className={`flex gap-3 border-b border-ink-50 px-4 py-3 hover:bg-ink-50 ${
                  active?.id === t.id ? "bg-brand-50" : ""
                }`}
              >
                <Avatar name={t.participantName} id={t.participantId} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-ink-900">
                      {t.participantName}
                    </p>
                    {t.unread > 0 ? <Badge tone="blue">{t.unread}</Badge> : null}
                  </div>
                  <p className="truncate text-xs font-medium text-ink-700">{t.subject}</p>
                  {t.preview ? (
                    <p className="mt-0.5 truncate text-xs text-ink-500">{excerpt(t.preview, 60)}</p>
                  ) : null}
                  <p className="mt-0.5 text-[11px] text-ink-400">{timeAgo(t.lastMessageAt)}</p>
                </div>
              </Link>
            ))}
          </div>

          {/* active thread */}
          <div className="flex min-h-96 flex-col">
            {active ? (
              <Suspense
                fallback={<div className="p-6 text-sm text-ink-500">Loading conversation…</div>}
              >
                <ThreadView threadId={active.id} viewerId={user.id} />
              </Suspense>
            ) : null}
          </div>
        </div>
      )}
    </>
  );
}
