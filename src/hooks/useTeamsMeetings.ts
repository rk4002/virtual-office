"use client";

// VirtualOffice — Teams meeting hooks
// useTeamsMeetings: fetch active meetings and poll for updates
// useCreateMeeting: create a new Teams meeting via Graph API
// useMeetingStatus: read/update current user's meeting status

import { useCallback, useEffect, useRef, useState } from "react";
import type { MeetingRoom, MeetingStatus } from "@/lib/db";

// ── useTeamsMeetings — poll for active meetings ──────────────────────────

export function useTeamsMeetings(pollMs: number = 10_000): {
  meetings: MeetingRoom[];
  loading: boolean;
  error: string | null;
} {
  const [meetings, setMeetings] = useState<MeetingRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    let timer: ReturnType<typeof setInterval> | null = null;

    const fetchMeetings = async () => {
      try {
        const res = await fetch("/api/teams/meetings");
        if (!res.ok) throw new Error("Kunne ikke hente møder");
        const data = await res.json();
        if (mounted) {
          setMeetings(data.meetings ?? []);
          setLoading(false);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Ukendt fejl");
          setLoading(false);
        }
      }
    };

    fetchMeetings();
    timer = setInterval(fetchMeetings, pollMs);

    return () => {
      mounted = false;
      if (timer) clearInterval(timer);
    };
  }, [pollMs]);

  return { meetings, loading, error };
}

// ── useCreateMeeting — create a Teams meeting ────────────────────────────

export function useCreateMeeting(): {
  createMeeting: (params: {
    subject?: string;
    roomId?: string;
  }) => Promise<{ meeting: { id: string; joinWebUrl: string; subject: string } } | null>;
  creating: boolean;
  error: string | null;
} {
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createMeeting = useCallback(
    async (params: { subject?: string; roomId?: string }) => {
      setCreating(true);
      setError(null);
      try {
        const res = await fetch("/api/teams/meeting", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? "Kunne ikke oprette møde");
        }
        const data = await res.json();
        return data;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Ukendt fejl";
        setError(msg);
        return null;
      } finally {
        setCreating(false);
      }
    },
    [],
  );

  return { createMeeting, creating, error };
}

// ── useEndMeeting — end (deactivate) a meeting ──────────────────────────

export function useEndMeeting(): {
  endMeeting: (meetingId: string) => Promise<boolean>;
  ending: boolean;
  error: string | null;
} {
  const [ending, setEnding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const endMeeting = useCallback(async (meetingId: string) => {
    setEnding(true);
    setError(null);
    try {
      const res = await fetch(`/api/teams/meeting?id=${encodeURIComponent(meetingId)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Kunne ikke afslutte møde");
      }
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Ukendt fejl";
      setError(msg);
      return false;
    } finally {
      setEnding(false);
    }
  }, []);

  return { endMeeting, ending, error };
}

// ── useAllMeetingStatuses — fetch all users' meeting statuses ────────────

export function useAllMeetingStatuses(pollMs: number = 10_000): {
  statuses: Map<string, MeetingStatus>;
  loading: boolean;
} {
  const [statuses, setStatuses] = useState<Map<string, MeetingStatus>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    let timer: ReturnType<typeof setInterval> | null = null;

    const fetchStatuses = async () => {
      try {
        const res = await fetch("/api/presence/status");
        if (!res.ok) return;
        const data = await res.json();
        if (mounted) {
          const map = new Map<string, MeetingStatus>();
          for (const s of data.statuses ?? []) {
            map.set(s.user_id, s.status);
          }
          setStatuses(map);
          setLoading(false);
        }
      } catch {
        // silent
      }
    };

    fetchStatuses();
    timer = setInterval(fetchStatuses, pollMs);

    return () => {
      mounted = false;
      if (timer) clearInterval(timer);
    };
  }, [pollMs]);

  return { statuses, loading };
}

// ── useMeetingStatus — current user's meeting status ─────────────────────

export function useMeetingStatus(userId: string): {
  status: MeetingStatus | null;
  setStatus: (status: MeetingStatus) => Promise<void>;
  allStatuses: Map<string, MeetingStatus>;
  loading: boolean;
} {
  const [status, setStatusState] = useState<MeetingStatus | null>(null);
  const [allStatuses, setAllStatuses] = useState<Map<string, MeetingStatus>>(new Map());
  const [loading, setLoading] = useState(true);

  // Fetch all statuses
  useEffect(() => {
    let mounted = true;

    const fetchStatuses = async () => {
      try {
        const res = await fetch("/api/presence/status");
        if (!res.ok) return;
        const data = await res.json();
        if (mounted) {
          const map = new Map<string, MeetingStatus>();
          for (const s of data.statuses ?? []) {
            map.set(s.user_id, s.status);
          }
          setAllStatuses(map);
          if (userId) {
            setStatusState(map.get(userId) ?? null);
          }
          setLoading(false);
        }
      } catch {
        // silent
      }
    };

    fetchStatuses();
    const timer = setInterval(fetchStatuses, 10_000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [userId]);

  const setStatus = useCallback(async (newStatus: MeetingStatus) => {
    try {
      const res = await fetch("/api/presence/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) return;
      setStatusState(newStatus);
    } catch {
      // silent
    }
  }, []);

  return { status, setStatus, allStatuses, loading };
}