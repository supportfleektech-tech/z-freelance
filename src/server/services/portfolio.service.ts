import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db as getDb } from "@/lib/db";
import { attachments, portfolioItems, users, type PortfolioItem } from "@/lib/db/schema";
import { config } from "@/lib/config";
import { ApiError } from "@/lib/api/http";
import type { CreatePortfolioItemInput, UpdatePortfolioItemInput } from "@/lib/validation";
import { deleteOwnedAttachmentQuietly, isImageMime } from "./storage.service";

/**
 * Freelancer portfolio management.
 *
 * Portfolios are the freelancer-facing half of reputation: reviews say what
 * clients thought, portfolio pieces show what the work looked like. Every
 * mutating operation is owner-only; reads for public profiles go through
 * `listPortfolioItems` with the freelancer's id.
 */

export interface PortfolioItemWithImage extends PortfolioItem {
  imageUrl: string | null;
}

function withImageUrl(item: PortfolioItem): PortfolioItemWithImage {
  return {
    ...item,
    imageUrl: item.imageAttachmentId ? `/api/files/${item.imageAttachmentId}` : null,
  };
}

/** A freelancer's own items, in display order. */
export async function listPortfolioItems(freelancerId: string): Promise<PortfolioItemWithImage[]> {
  const database = await getDb();
  const rows = await database
    .select()
    .from(portfolioItems)
    .where(eq(portfolioItems.freelancerId, freelancerId))
    .orderBy(asc(portfolioItems.position), desc(portfolioItems.createdAt));
  return rows.map(withImageUrl);
}

/** Validate an optional cover image upload: must be ours, a portfolio image. */
async function assertUsableCoverImage(userId: string, imageAttachmentId: string): Promise<void> {
  const database = await getDb();
  const [image] = await database
    .select()
    .from(attachments)
    .where(eq(attachments.id, imageAttachmentId))
    .limit(1);
  if (!image) throw ApiError.badRequest("The referenced cover image does not exist.");
  if (image.uploaderId !== userId) {
    throw ApiError.forbidden("You can only use files you uploaded.");
  }
  if (image.context !== "PORTFOLIO" || !isImageMime(image.mimeType)) {
    throw ApiError.unprocessable("The cover image must be an image file uploaded for a portfolio.");
  }
}

export async function createPortfolioItem(
  userId: string,
  input: CreatePortfolioItemInput,
): Promise<PortfolioItemWithImage> {
  const database = await getDb();

  const [user] = await database
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (user?.role !== "FREELANCER" && user?.role !== "ADMIN") {
    throw ApiError.forbidden("Only freelancers can publish portfolio items.");
  }

  if (input.imageAttachmentId) await assertUsableCoverImage(userId, input.imageAttachmentId);

  return database.transaction(async (tx) => {
    const [countRow] = await tx
      .select({ value: sql<number>`count(*)::int` })
      .from(portfolioItems)
      .where(eq(portfolioItems.freelancerId, userId));
    const count = countRow?.value ?? 0;
    if (count >= config.limits.portfolioItemsPerFreelancer) {
      throw ApiError.conflict(
        `Portfolios are limited to ${config.limits.portfolioItemsPerFreelancer} items.`,
      );
    }

    const [maxRow] = await tx
      .select({ value: sql<number>`coalesce(max(${portfolioItems.position}), -1)::int` })
      .from(portfolioItems)
      .where(eq(portfolioItems.freelancerId, userId));

    const [created] = await tx
      .insert(portfolioItems)
      .values({
        freelancerId: userId,
        title: input.title,
        description: input.description ?? null,
        url: input.url ?? null,
        imageAttachmentId: input.imageAttachmentId ?? null,
        position: (maxRow?.value ?? -1) + 1,
      })
      .returning();
    if (!created) throw new Error("portfolio insert returned no row");
    return withImageUrl(created);
  });
}

export async function updatePortfolioItem(
  userId: string,
  itemId: string,
  input: UpdatePortfolioItemInput,
): Promise<PortfolioItemWithImage> {
  const database = await getDb();

  return database.transaction(async (tx) => {
    const [item] = await tx
      .select()
      .from(portfolioItems)
      .where(and(eq(portfolioItems.id, itemId), eq(portfolioItems.freelancerId, userId)))
      .limit(1);
    if (!item) throw ApiError.notFound("Portfolio item not found.");

    if (input.imageAttachmentId && input.imageAttachmentId !== item.imageAttachmentId) {
      await assertUsableCoverImage(userId, input.imageAttachmentId);
    }

    const [updated] = await tx
      .update(portfolioItems)
      .set({
        title: input.title ?? item.title,
        description: input.description !== undefined ? input.description : item.description,
        url: input.url !== undefined ? input.url : item.url,
        imageAttachmentId:
          input.imageAttachmentId !== undefined
            ? (input.imageAttachmentId ?? null)
            : item.imageAttachmentId,
        updatedAt: new Date(),
      })
      .where(eq(portfolioItems.id, item.id))
      .returning();
    if (!updated) throw ApiError.conflict("The portfolio item could not be updated.");

    // A replaced cover image is no longer referenced anywhere — tidy up.
    if (updated.imageAttachmentId !== item.imageAttachmentId && item.imageAttachmentId) {
      await deleteOwnedAttachmentQuietly(tx, userId, item.imageAttachmentId);
    }

    return withImageUrl(updated);
  });
}

export async function deletePortfolioItem(userId: string, itemId: string): Promise<void> {
  const database = await getDb();

  await database.transaction(async (tx) => {
    const [item] = await tx
      .select()
      .from(portfolioItems)
      .where(and(eq(portfolioItems.id, itemId), eq(portfolioItems.freelancerId, userId)))
      .limit(1);
    if (!item) throw ApiError.notFound("Portfolio item not found.");

    await tx.delete(portfolioItems).where(eq(portfolioItems.id, item.id));
    await deleteOwnedAttachmentQuietly(tx, userId, item.imageAttachmentId);
  });
}
