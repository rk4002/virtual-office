// VirtualOffice — Microsoft Graph Teams meeting helper
// Uses the user's OAuth access token from NextAuth Azure AD SSO
// to create and manage Teams online meetings via Microsoft Graph.
//
// Requires: AUTH_MICROSOFT_ENTRA_ID_ID + AUTH_MICROSOFT_ENTRA_ID_SECRET for auth.
// The user must have consented to OnlineMeetings.ReadWrite scope.

import {
  Client,
} from "@microsoft/microsoft-graph-client";

// ── Token scope for Microsoft Graph ───────────────────────────────────────
// Must be requested in your NextAuth config (see lib/auth.ts):
//   scope: "openid profile email OnlineMeetings.ReadWrite"

export const GRAPH_SCOPES = ["OnlineMeetings.ReadWrite"];

// ── Graph client factory (user token) ──────────────────────────────────────

/**
 * Create a Microsoft Graph client using the user's access token
 * from Azure AD SSO (NextAuth).
 *
 * @param accessToken - The user's OAuth 2.0 access token with Graph scopes
 */
export function createGraphClient(accessToken: string): Client {
  return Client.init({
    authProvider: (done) => {
      done(null, accessToken);
    },
  });
}

// ── Teams meeting types ──────────────────────────────────────────────────

export interface TeamsMeeting {
  id: string; // Graph meeting ID
  joinWebUrl: string;
  subject: string;
  startDateTime: string;
  endDateTime: string;
  joinUrl: string; // legacy / alternative
  creationDateTime: string;
  participants?: {
    attendees: { upn: string; name?: string }[];
  };
}

export interface CreateMeetingParams {
  subject?: string;
  startDateTime?: string;
  endDateTime?: string;
  attendees?: string[]; // UPNs of attendees to invite
}

// ── API ──────────────────────────────────────────────────────────────────

/** Create an online Teams meeting via Microsoft Graph using the user's token.
 *  Returns the meeting details including join URLs. */
export async function createTeamsMeeting(
  accessToken: string,
  params: CreateMeetingParams = {},
): Promise<TeamsMeeting> {
  const client = createGraphClient(accessToken);

  const now = new Date();
  const start = params.startDateTime
    ? new Date(params.startDateTime)
    : new Date(now.getTime() + 60_000); // 1 min from now
  const end = params.endDateTime
    ? new Date(params.endDateTime)
    : new Date(start.getTime() + 60 * 60_000); // 1 hour

  const subject = params.subject ?? "VirtualOffice Teams møde";

  const attendees = (params.attendees ?? []).map((upn) => ({
    "@odata.type": "#microsoft.graph.meetingParticipantInfo",
    upn,
  }));

  const body: Record<string, unknown> = {
    subject,
    startDateTime: start.toISOString(),
    endDateTime: end.toISOString(),
    participants: {
      attendees,
    },
  };

  const response = await client
    .api("/me/onlineMeetings")
    .post(body);

  const raw = response as Record<string, unknown>;

  return {
    id: raw.id as string,
    joinWebUrl: raw.joinWebUrl as string,
    subject: raw.subject as string,
    startDateTime: raw.startDateTime as string,
    endDateTime: raw.endDateTime as string,
    joinUrl: (raw.joinUrl ?? raw.joinWebUrl) as string,
    creationDateTime: (raw.creationDateTime ?? raw.createdDateTime) as string,
    participants: raw.participants
      ? {
          attendees: (
            (raw.participants as Record<string, unknown>)
              .attendees as Array<Record<string, unknown>>
          )?.map((a) => ({
            upn: a.upn as string,
            name: a.name as string | undefined,
          })) ?? [],
        }
      : undefined,
  };
}

/** Get an existing online meeting by ID. */
export async function getTeamsMeeting(
  accessToken: string,
  meetingId: string,
): Promise<TeamsMeeting | null> {
  const client = createGraphClient(accessToken);
  try {
    const raw = (await client
      .api(`/me/onlineMeetings/${meetingId}`)
      .get()) as Record<string, unknown>;

    if (!raw?.id) return null;

    return {
      id: raw.id as string,
      joinWebUrl: raw.joinWebUrl as string,
      subject: raw.subject as string,
      startDateTime: raw.startDateTime as string,
      endDateTime: raw.endDateTime as string,
      joinUrl: (raw.joinUrl ?? raw.joinWebUrl) as string,
      creationDateTime: (raw.creationDateTime ?? raw.createdDateTime) as string,
      participants: raw.participants
        ? {
            attendees: (
              (raw.participants as Record<string, unknown>)
                .attendees as Array<Record<string, unknown>>
            )?.map((a) => ({
              upn: a.upn as string,
              name: a.name as string | undefined,
            })) ?? [],
          }
        : undefined,
    };
  } catch {
    return null;
  }
}