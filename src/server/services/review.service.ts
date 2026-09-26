import { aliasedTable, desc, eq, sql } from "drizzle-orm";
import { db as getDb, type Tx } from "@/lib/db";
import {
  clientProfiles,
  contracts,
  freelancerProfiles,
  reviews,
  users,
  type Review,
} from "@/lib/db/schema";
import { ApiError, isUniqueViolation } from "@/lib/api/http";
import { notify } from "./notification.service";

const reviewAuthor = aliasedTable(users, "review_author");
const reviewSubject = aliasedTable(users, "review_subject");

export interface ReviewWithAuthor extends Review {
  authorName: string;
  subjectName: string;
  contractTitle: string;
}

/**
 * Publish a review for a completed contract.
 *
 * Reviews are symmetric: the client rates the freelancer and the freelancer
 * rates the client, once each, and only after the contract has completed.
 * Rating aggregates on the subject's profile are recomputed from the review
 * table inside the same transaction, so they can never drift.
 */
export async function createReview(
  authorId: string,
  input: { contractId: string; rating: number; comment?: string },
): Promise<Review> {
  const database = await getDb();

  try {
    return await database.transaction(async (tx) => {
      const [contract] = await tx
        .select()
        .from(contracts)
        .where(eq(contracts.id, input.contractId))
        .limit(1);
      if (!contract) throw ApiError.notFound("Contract not found.");

      if (contract.clientId !== authorId && contract.freelancerId !== authorId) {
        throw ApiError.forbidden("You are not a party to this contract.");
      }
      if (contract.status !== "COMPLETED") {
        throw ApiError.conflict("Reviews can only be left once a contract is complete.");
      }

      const isClientAuthor = contract.clientId === authorId;
      const subjectId = isClientAuthor ? contract.freelancerId : contract.clientId;

      const [review] = await tx
        .insert(reviews)
        .values({
          contractId: contract.id,
          authorId,
          subjectId,
          direction: isClientAuthor ? "CLIENT_TO_FREELANCER" : "FREELANCER_TO_CLIENT",
          rating: input.rating,
          comment: input.comment ?? null,
        })
        .returning();
      if (!review) throw new Error("review insert returned no row");

      await refreshRating(tx, subjectId);

      // The notification names the AUTHOR — the receiver already knows who they are.
      const [author] = await tx
        .select({ name: users.name })
        .from(users)
        .where(eq(users.id, authorId))
        .limit(1);

      await notify(tx, {
        userId: subjectId,
        type: "REVIEW_RECEIVED",
        title: `${author?.name ?? "Someone"} left you a ${input.rating}-star review`,
        link: "/dashboard/reviews",
      });

      return review;
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw ApiError.conflict("You have already reviewed this contract.");
    }
    throw error;
  }
}

/** Recompute a user's average rating from the review table. */
async function refreshRating(tx: Tx, userId: string): Promise<void> {
  const [row] = await tx
    .select({
      count: sql<number>`count(*)::int`,
      average: sql<string>`coalesce(round(avg(${reviews.rating})::numeric, 2), 0)`,
    })
    .from(reviews)
    .where(eq(reviews.subjectId, userId));

  const count = row?.count ?? 0;
  const average = Number(row?.average ?? 0);

  const freelancerUpdated = await tx
    .update(freelancerProfiles)
    .set({ ratingCount: count, ratingAvg: average, updatedAt: new Date() })
    .where(eq(freelancerProfiles.userId, userId))
    .returning({ id: freelancerProfiles.id });

  if (freelancerUpdated.length === 0) {
    await tx
      .update(clientProfiles)
      .set({ ratingCount: count, ratingAvg: average, updatedAt: new Date() })
      .where(eq(clientProfiles.userId, userId));
  }
}

/**
 * The review subject's single public right of reply.
 *
 * A response is written once (edit = replace while the review is young is
 * intentionally not supported — replies should be considered, not iterated),
 * and the author is notified so the conversation closes the loop.
 */
export async function respondToReview(
  userId: string,
  reviewId: string,
  text: string,
): Promise<Review> {
  const database = await getDb();

  return database.transaction(async (tx) => {
    const [review] = await tx.select().from(reviews).where(eq(reviews.id, reviewId)).limit(1);
    if (!review) throw ApiError.notFound("Review not found.");
    if (review.subjectId !== userId) {
      throw ApiError.forbidden("Only the person being reviewed can respond.");
    }
    if (review.responseAt) {
      throw ApiError.conflict("You have already responded to this review.");
    }

    const [updated] = await tx
      .update(reviews)
      .set({ responseText: text, responseAt: new Date() })
      .where(eq(reviews.id, reviewId))
      .returning();
    if (!updated) throw new Error("review response update returned no row");

    const [responder] = await tx
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    await notify(tx, {
      userId: review.authorId,
      type: "REVIEW_RECEIVED",
      title: `${responder?.name ?? "The recipient"} responded to your review`,
      link: "/dashboard/reviews",
    });

    return updated;
  });
}

/** Retract a pending response (only the responder, only their own). */
export async function deleteReviewResponse(userId: string, reviewId: string): Promise<void> {
  const database = await getDb();
  const [review] = await database.select().from(reviews).where(eq(reviews.id, reviewId)).limit(1);
  if (!review) throw ApiError.notFound("Review not found.");
  if (review.subjectId !== userId) throw ApiError.forbidden("This is not your response.");
  if (!review.responseAt) return;

  await database
    .update(reviews)
    .set({ responseText: null, responseAt: null })
    .where(eq(reviews.id, reviewId));
}

/** Reviews received by a user, newest first. */
export async function listReviewsForUser(userId: string): Promise<ReviewWithAuthor[]> {
  const database = await getDb();

  const rows = await database
    .select({
      review: reviews,
      authorName: reviewAuthor.name,
      subjectName: reviewSubject.name,
      contractTitle: contracts.title,
    })
    .from(reviews)
    .innerJoin(reviewAuthor, eq(reviewAuthor.id, reviews.authorId))
    .innerJoin(reviewSubject, eq(reviewSubject.id, reviews.subjectId))
    .innerJoin(contracts, eq(contracts.id, reviews.contractId))
    .where(eq(reviews.subjectId, userId))
    .orderBy(desc(reviews.createdAt));

  return rows.map(({ review, ...rest }) => ({ ...review, ...rest }));
}

/** Aggregate rating for a user, tolerant of users with no reviews yet. */
export async function ratingSummary(userId: string): Promise<{ average: number; count: number }> {
  const database = await getDb();
  const [row] = await database
    .select({
      count: sql<number>`count(*)::int`,
      average: sql<string>`coalesce(round(avg(${reviews.rating})::numeric, 2), 0)`,
    })
    .from(reviews)
    .where(eq(reviews.subjectId, userId));
  return { average: Number(row?.average ?? 0), count: row?.count ?? 0 };
}
