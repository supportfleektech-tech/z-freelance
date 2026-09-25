import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guards";
import { listReviewsForUser, ratingSummary } from "@/server/services/review.service";
import { timeAgo } from "@/lib/utils";
import { PageHeader, Stars, Card, CardHeader, EmptyState, Stat } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reviews" };

export default async function ReviewsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard/reviews");

  const [reviews, rating] = await Promise.all([
    listReviewsForUser(user.id),
    ratingSummary(user.id),
  ]);

  return (
    <>
      <PageHeader
        title="Reviews"
        description="What clients and freelancers who worked with you in escrow have said."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Average rating" value={rating.count > 0 ? rating.average.toFixed(2) : "—"} />
        <Stat label="Reviews received" value={String(rating.count)} />
      </div>

      <div className="mt-8">
        {reviews.length === 0 ? (
          <EmptyState
            title="No reviews yet"
            description="Complete a contract and the other party can leave you a review — it's how reputations are built here."
          />
        ) : (
          <div className="space-y-4">
            {reviews.map((review) => (
              <Card key={review.id}>
                <CardHeader
                  title={`${review.authorName}`}
                  description={`on “${review.contractTitle}” · ${timeAgo(review.createdAt)}`}
                  actions={<Stars rating={review.rating} />}
                />
                {review.comment ? (
                  <p className="text-sm leading-7 text-ink-700">{review.comment}</p>
                ) : null}
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
