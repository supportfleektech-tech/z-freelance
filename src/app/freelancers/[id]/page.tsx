import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getFreelancerPublicProfile,
  listFreelancerWork,
} from "@/server/services/freelancer.service";
import { listReviewsForUser } from "@/server/services/review.service";
import { listPortfolioItems } from "@/server/services/portfolio.service";
import { getCurrentUser } from "@/lib/auth/guards";
import { formatMoneyCompact, formatMoney } from "@/lib/money";
import { timeAgo, formatDate } from "@/lib/utils";
import { Badge, Card, CardHeader, Stars, Avatar, StatusBadge, Stat } from "@/components/ui";
import { Globe, MapPin, Calendar, ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function FreelancerProfilePage({ params }: Props) {
  const { id } = await params;
  const [profile, viewer] = await Promise.all([getFreelancerPublicProfile(id), getCurrentUser()]);
  if (!profile) notFound();

  const [work, reviews, portfolio] = await Promise.all([
    listFreelancerWork(profile.userId),
    listReviewsForUser(profile.userId),
    listPortfolioItems(profile.userId),
  ]);

  const isSelf = viewer?.role === "FREELANCER";

  return (
    <main className="container-page py-10">
      <div className="grid gap-8 lg:grid-cols-[320px_1fr]">
        <aside className="space-y-4">
          <Card className="text-center">
            <div className="mx-auto w-fit">
              <Avatar
                name={profile.name}
                id={profile.userId}
                size="lg"
                avatarUrl={profile.avatarUrl}
              />
            </div>
            <h1 className="mt-3 text-xl font-bold text-ink-950">{profile.name}</h1>
            <p className="mt-1 text-sm text-ink-600">
              {profile.headline ?? "Independent specialist"}
            </p>
            <div className="mt-2 flex justify-center">
              <Stars rating={profile.ratingAvg} count={profile.ratingCount} />
            </div>
            <div className="mt-3 flex justify-center">
              <StatusBadge status={profile.availability} />
            </div>

            <div className="mt-5 space-y-2 border-t border-ink-100 pt-4 text-left text-sm">
              {profile.country ? (
                <p className="flex items-center gap-2 text-ink-600">
                  <MapPin size={14} className="text-ink-400" />
                  {[profile.city, profile.country].filter(Boolean).join(", ")}
                </p>
              ) : null}
              <p className="flex items-center gap-2 text-ink-600">
                <Calendar size={14} className="text-ink-400" />
                Member since {formatDate(profile.memberSince)}
              </p>
              {profile.hourlyRateCents != null ? (
                <p className="flex items-center gap-2 font-semibold text-ink-900">
                  <Globe size={14} className="text-ink-400" />
                  {formatMoneyCompact(profile.hourlyRateCents)}/hr
                </p>
              ) : null}
            </div>

            {isSelf ? (
              <Link href="/dashboard/profile" className="btn-secondary mt-5 w-full">
                Edit your profile
              </Link>
            ) : viewer ? (
              <Link href="/dashboard/projects/new" className="btn-primary mt-5 w-full">
                Invite to your project
                <ArrowRight size={14} />
              </Link>
            ) : (
              <Link href="/login" className="btn-secondary mt-5 w-full">
                Sign in to contact
              </Link>
            )}
          </Card>

          <div className="grid grid-cols-2 gap-3">
            <Stat label="Earned here" value={formatMoneyCompact(profile.totalEarnedCents)} />
            <Stat label="Contracts" value={String(profile.completedContracts)} />
          </div>
        </aside>

        <div className="space-y-6">
          {profile.bio ? (
            <Card>
              <CardHeader title="About" />
              <p className="whitespace-pre-wrap text-sm leading-7 text-ink-700">{profile.bio}</p>
            </Card>
          ) : null}

          {profile.skills.length > 0 ? (
            <Card>
              <CardHeader title="Skills" />
              <div className="flex flex-wrap gap-2">
                {profile.skills.map((skill) => (
                  <Badge key={skill} tone="blue">
                    {skill}
                  </Badge>
                ))}
              </div>
            </Card>
          ) : null}

          {portfolio.length > 0 ? (
            <Card>
              <CardHeader
                title={`Portfolio (${portfolio.length})`}
                description="Selected work this specialist chose to show"
              />
              <ul className="grid gap-4 sm:grid-cols-2">
                {portfolio.map((item) => (
                  <li
                    key={item.id}
                    className="overflow-hidden rounded-xl border border-ink-200 transition-shadow hover:shadow-md"
                  >
                    {item.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- user-uploaded portfolio art, exact intrinsic size unknown
                      <img
                        src={item.imageUrl}
                        alt={item.title}
                        className="h-36 w-full object-cover"
                        loading="lazy"
                      />
                    ) : null}
                    <div className="p-3">
                      <p className="text-sm font-semibold text-ink-900">{item.title}</p>
                      {item.description ? (
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-ink-600">
                          {item.description}
                        </p>
                      ) : null}
                      {item.url ? (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline"
                        >
                          View project <ArrowRight size={12} />
                        </a>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {work.length > 0 ? (
            <Card>
              <CardHeader
                title="Winning engagements"
                description={`${work.length} hired through z-freelance escrow`}
              />
              <ul className="divide-y divide-ink-100">
                {work.map((item) => (
                  <li key={item.id} className="flex items-center justify-between py-3 text-sm">
                    <span className="text-ink-800">{item.title}</span>
                    <span className="font-semibold tabular-nums text-ink-900">
                      {formatMoney(item.amountCents)}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          <Card>
            <CardHeader title={`Reviews (${reviews.length})`} />
            {reviews.length === 0 ? (
              <p className="text-sm text-ink-500">
                No reviews yet — this specialist is early in their journey here.
              </p>
            ) : (
              <ul className="divide-y divide-ink-100">
                {reviews.map((review) => (
                  <li key={review.id} className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Stars rating={review.rating} />
                        <span className="text-sm font-medium text-ink-900">
                          {review.authorName}
                        </span>
                        <span className="text-xs text-ink-400">on “{review.contractTitle}”</span>
                      </div>
                      <span className="text-xs text-ink-400">{timeAgo(review.createdAt)}</span>
                    </div>
                    {review.comment ? (
                      <p className="mt-2 text-sm text-ink-600">{review.comment}</p>
                    ) : null}
                    {review.responseText ? (
                      <div className="mt-2 rounded-lg bg-ink-50 p-3 text-xs leading-5 text-ink-600">
                        <span className="font-semibold text-ink-800">Response: </span>
                        {review.responseText}
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </main>
  );
}
