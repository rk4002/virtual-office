"use client";

// VirtualOffice — useCoffeeMatch hook
// Håndterer dagens virtuelle kaffematch: request, poll, og state.
// Idempotent: POST kaldes én gang per dag; GET poller for mutual updates.
//
// Flow:
//   1. Ved mount: GET /api/coffee?user_id=X → hvis match findes, vis det
//   2. Bruger klikker "☕ Tag en kaffepause": POST /api/coffee → nyt match
//   3. Poll hvert 10. sekund for at opdage mutual matches

import { useCallback, useEffect, useRef, useState } from "react";
import type { CoffeeMatch } from "@/lib/db";

export type { CoffeeMatch };

interface CoffeeMatchState {
  match: CoffeeMatch | null;
  loading: boolean;
  error: string | null;
  requestMatch: () => Promise<void>;
  dismiss: () => void;
  dismissed: boolean;
}

const POLL_MS = 10_000; // poll every 10 seconds

export function useCoffeeMatch(
  userId: string,
  userName: string,
): CoffeeMatchState {
  const [match, setMatch] = useState<CoffeeMatch | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const userIdRef = useRef(userId);
  const userNameRef = useRef(userName);
  userIdRef.current = userId;
  userNameRef.current = userName;

  // Fetch existing match (called on mount + poll)
  const fetchMatch = useCallback(async () => {
    const uid = userIdRef.current;
    if (!uid) return;

    try {
      const res = await fetch(`/api/coffee?user_id=${encodeURIComponent(uid)}`);
      const data = await res.json();
      if (data.ok && data.match) {
        setMatch(data.match);
      }
    } catch {
      // silently ignore poll errors
    }
  }, []);

  // On mount: fetch existing match + start polling
  useEffect(() => {
    if (!userId) return;

    fetchMatch();

    pollRef.current = setInterval(fetchMatch, POLL_MS);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [userId, fetchMatch]);

  // Reset dismissed when userId changes (new user)
  useEffect(() => {
    setDismissed(false);
  }, [userId]);

  // Request a new match
  const requestMatch = useCallback(async () => {
    const uid = userIdRef.current;
    const uname = userNameRef.current;
    if (!uid || !uname) return;

    setLoading(true);
    setError(null);
    setDismissed(false);

    try {
      const res = await fetch("/api/coffee", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: uid, user_name: uname }),
      });
      const data = await res.json();

      if (data.ok && data.match) {
        setMatch(data.match);
      } else {
        setError(
          data.error ?? "Kunne ikke finde en kaffemakker lige nu — prøv igen senere.",
        );
      }
    } catch {
      setError("Netværksfejl — kunne ikke oprette kaffematch.");
    } finally {
      setLoading(false);
    }
  }, []);

  const dismiss = useCallback(() => {
    setDismissed(true);
  }, []);

  return { match, loading, error, requestMatch, dismiss, dismissed };
}