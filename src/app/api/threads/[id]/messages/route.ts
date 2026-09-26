import type { NextRequest } from "next/server";
import { ApiError, created, parseBody, parseParams, route, throttle } from "@/lib/api/http";
import { idParamSchema, sendMessageSchema } from "@/lib/validation";
import { requireUser } from "@/lib/auth/guards";
import { sendMessage } from "@/server/services/messaging.service";
import { db as getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

/** POST /api/threads/:id/messages — reply in a conversation. */
export const POST = route(
  async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
    throttle(request, "api", "messages:send");

    const { id } = await parseParams(context.params, idParamSchema);
    const user = await requireUser();
    const input = await parseBody(request, sendMessageSchema);

    if (input.threadId !== id) {
      throw ApiError.badRequest("The threadId in the body does not match the URL.");
    }
    return created(await sendInThread(user.id, id, input.body, input.attachmentIds));
  },
);

async function sendInThread(
  userId: string,
  threadId: string,
  body: string,
  attachmentIds: string[],
) {
  const database = await getDb();
  return database.transaction(async (tx) =>
    sendMessage(tx, { threadId, senderId: userId, body, attachmentIds }),
  );
}
