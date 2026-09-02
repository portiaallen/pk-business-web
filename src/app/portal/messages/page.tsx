"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MessageSquare } from "lucide-react";

type Message = {
  id: string;
  body: string;
  isFromStaff: boolean;
  authorName: string;
  requestTitle: string;
  requestId: string;
  createdAt: string;
};

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function PortalMessagesPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchMessages() {
      try {
        const res = await fetch("/api/portal/messages");
        if (res.ok) {
          setMessages(await res.json());
        }
      } catch {
        // empty
      } finally {
        setLoading(false);
      }
    }
    fetchMessages();
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-3xl font-semibold text-charcoal">
          Messages
        </h1>
        <p className="mt-2 text-muted-gray">
          Communications related to your service requests.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <p className="text-sm text-muted-gray">Loading messages...</p>
        </div>
      ) : messages.length === 0 ? (
        <div className="rounded-lg border border-border bg-card py-16 text-center">
          <MessageSquare className="mx-auto size-10 text-muted-gray/40" />
          <h3 className="mt-3 font-heading text-lg font-semibold text-charcoal">
            No messages yet
          </h3>
          <p className="mt-1 text-sm text-muted-gray">
            Messages will appear here when PK Business Services communicates with you.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border rounded-lg border border-border bg-card">
          {messages.map((msg) => (
            <Link
              key={msg.id}
              href={`/portal/requests/${msg.requestId}`}
              className="block px-6 py-4 transition-colors hover:bg-cream/50"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-charcoal">
                    {msg.authorName}
                  </span>
                  {msg.isFromStaff && (
                    <span className="rounded bg-charcoal px-1.5 py-0.5 text-[10px] font-medium text-ivory">
                      PK Staff
                    </span>
                  )}
                </div>
                <span className="text-xs text-muted-gray">
                  {formatTime(msg.createdAt)}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-gray line-clamp-2">
                {msg.body}
              </p>
              <p className="mt-1 text-xs text-muted-gray">
                Re: {msg.requestTitle}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
