"use client";

// VirtualOffice — Reaction hooks
// useReactions: fetch and toggle emoji reactions on chat messages
// useMessageReactions: fetch reactions for a specific set of message IDs
//
// Works alongside useChat — reactions are fetched/updated independently
// via the /api/chat/reactions endpoint.

import { useCallback, useEffect, useRef, useState } from "react";
import type { AggregatedReaction } from "@/lib/db";

export type { AggregatedReaction };

// ── useReactions — fetch + toggle reactions ──────────────────────────────────

export interface UseReactionsReturn {
  /** Map<message_id, AggregatedReaction[]> — current reactions */
  reactions: Map<string, AggregatedReaction[]>;
  /** Toggle a reaction on a message. Returns the action taken + updated aggregates for that message. */
  toggle: (params: {
    message_id: string;
    emoji: string;
    user_id: string;
    user_name: string;
  }) => Promise<{ action: "added" | "removed"; reactions: AggregatedReaction[] }>;
  /** Check if the current user has reacted with a specific emoji on a message */
  hasReacted: (message_id: string, emoji: string, user_id: string) => boolean;
  /** Manually refresh reactions for a set of message IDs */
  refresh: (messageIds: string[]) => Promise<void>;
}

export function useReactions(
  /** Current user ID (for checking own reactions) */
  currentUserId: string,
  /** Optional: message IDs to auto-fetch reactions for on mount/change */
  messageIds?: string[],
): UseReactionsReturn {
  const [reactions, setReactions] = useState<Map<string, AggregatedReaction[]>>(new Map());
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ── fetch reactions ─────────────────────────────────────────────────────

  const refresh = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;

    try {
      const res = await fetch(`/api/chat/reactions?ids=${ids.join(",")}`);
      if (!res.ok) return;

      const data = await res.json();
      if (!data.ok) return;

      const next = new Map<string, AggregatedReaction[]>();
      for (const [msgId, aggregated] of Object.entries(data.reactions)) {
        next.set(msgId, aggregated as AggregatedReaction[]);
      }

      setReactions((prev) => {
        const merged = new Map(prev);
        for (const [id, reacts] of next) {
          merged.set(id, reacts);
        }
        return merged;
      });
    } catch {
      // ignore — will retry on next message batch
    }
  }, []);

  // Auto-fetch when messageIds change
  useEffect(() => {
    if (messageIds && messageIds.length > 0) {
      refresh(messageIds);
    }
  }, [messageIds?.join(","), refresh]);

  // ── toggle ──────────────────────────────────────────────────────────────

  const toggle = useCallback(
    async (params: {
      message_id: string;
      emoji: string;
      user_id: string;
      user_name: string;
    }): Promise<{ action: "added" | "removed"; reactions: AggregatedReaction[] }> => {
      const res = await fetch("/api/chat/reactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(err.error || "Failed to toggle reaction");
      }

      const data = await res.json();

      // Update local state
      setReactions((prev) => {
        const next = new Map(prev);
        next.set(params.message_id, data.reactions);
        return next;
      });

      return data;
    },
    [],
  );

  // ── hasReacted ──────────────────────────────────────────────────────────

  const hasReacted = useCallback(
    (message_id: string, emoji: string, user_id: string): boolean => {
      const agg = reactions.get(message_id);
      if (!agg) return false;
      const entry = agg.find((a) => a.emoji === emoji);
      if (!entry) return false;
      return entry.users.includes(user_id);
    },
    [reactions],
  );

  return { reactions, toggle, hasReacted, refresh };
}