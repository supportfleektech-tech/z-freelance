import type { NextRequest } from "next/server";
import { created, ok, parseBody, route, throttle } from "@/lib/api/http";
import { startThreadSchema } from "@/lib/validation";
import { requireUser } from "@/lib/auth/guards";
import {
  getOrCreateThread,
  listThreads,
  resolveThreadAnchor,
  sendMessage,
} from "@/server/services/messaging.service";
import { ApiError } from "@/lib/api/http";
import { db as getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET  /api/threads — the caller's inbox.
 * POST /api/threads — start (or reuse) a conversation about a proposal,
 *                     contract or project and send the first message.
 */
export const GET = route(async (request: NextRequest) => {
  throttle(request, "api", "threads:list");

  const user = await requireUser();
  return ok({ threads: await listThreads(user.id) });
});

export const POST = route(async (request: NextRequest) => {
  throttle(request, "api", "threads:start");

  const user = await requireUser();
  const input = await parseBody(request, startThreadSchema);

  const anchor = await resolveThreadAnchor({
    proposalId: input.proposalId,
    contractId: input.contractId,
    projectId: input.projectId,
  });
  if (!anchor) throw ApiError.notFound("That proposal, contract or project does not exist.");

  let counterpartyId: string;
  if (anchor.partyBId === null) {
    // Open anchor: anyone except the owner may start a conversation about a project.
    if (user.id === anchor.partyAId) {
      throw ApiError.badRequest("You cannot start a conversation about your own project.");
    }
    counterpartyId = anchor.partyAId;
  } else {
    if (user.id !== anchor.partyAId && user.id !== anchor.partyBId) {
      throw ApiError.forbidden("You are not a party to this conversation.");
    }
    counterpartyId = user.id === anchor.partyAId ? anchor.partyBId : anchor.partyAId;
  }

  const database = await getDb();
  const thread = await database.transaction(async (tx) => {
    const created = await getOrCreateThread(tx, {
      participantAId: user.id,
      participantBId: counterpartyId,
      subject: input.subject ?? anchor.subject,
      contractId: anchor.contractId,
      proposalId: anchor.proposalId,
      projectId: anchor.projectId,
    });
    await sendMessage(tx, { threadId: created.id, senderId: user.id, body: input.body });
    return created;
  });

  return created({ threadId: thread.id }, `/api/threads/${thread.id}`);
});
