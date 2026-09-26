import { getThread } from "@/server/services/messaging.service";
import { Avatar } from "./ui";
import { AttachmentList } from "./file-upload";
import { MessageComposer } from "./message-composer";
import { timeAgo } from "@/lib/utils";

/** Server-rendered history + a small client composer below it. */
export async function ThreadView({ threadId, viewerId }: { threadId: string; viewerId: string }) {
  const { thread, messages } = await getThread(viewerId, threadId);

  return (
    <>
      <div className="border-b border-ink-100 px-4 py-3">
        <p className="text-sm font-semibold text-ink-900">{thread.subject}</p>
        <p className="text-xs text-ink-500">with {thread.participantName}</p>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.map((message) => {
          const own = message.senderId === viewerId;
          return (
            <div key={message.id} className={`flex gap-2 ${own ? "flex-row-reverse" : ""}`}>
              <Avatar name={own ? "You" : thread.participantName} id={message.senderId} size="sm" />
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm leading-6 ${
                  own
                    ? "rounded-br-sm bg-brand-600 text-white"
                    : "rounded-bl-sm bg-ink-100 text-ink-900"
                }`}
              >
                <p className="whitespace-pre-wrap">{message.body}</p>
                <AttachmentList attachments={message.attachments} tone={own ? "dark" : "light"} />
                <p className={`mt-1 text-[10px] ${own ? "text-brand-200" : "text-ink-400"}`}>
                  {timeAgo(message.createdAt)}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t border-ink-100 p-4">
        <MessageComposer threadId={threadId} />
      </div>
    </>
  );
}
