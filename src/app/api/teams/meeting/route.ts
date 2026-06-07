// VirtualOffice — Teams meeting API
// POST /api/teams/meeting — create a new Teams online meeting
// GET  /api/teams/meeting — get active meeting for the current user
// DELETE /api/teams/meeting — end/deactivate a meeting
//
// Uses Microsoft Graph API via the user's Azure AD access token
// stored in the NextAuth session.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createTeamsMeeting, getTeamsMeeting } from "@/lib/teams-graph";
import {
  initMeetingRoomsSchema,
  createMeetingRoom,
  deactivateMeeting,
  getMeetingRoom,
} from "@/lib/db";

// ── POST /api/teams/meeting — create a Teams meeting ─────────────────────

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    const accessToken = session.accessToken;
    if (!accessToken) {
      return NextResponse.json(
        {
          error:
            "Ingen Microsoft Graph adgangstoken. Log ind igen med Teams møde-tilladelser (OnlineMeetings.ReadWrite scope).",
        },
        { status: 403 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const { subject, roomId } = body;

    const userId = session.user.id ?? "unknown";
    const userName = session.user.name ?? "Ukendt";
    const meetingSubject =
      subject || `VirtualOffice møde — ${roomId || userName}`;

    const meeting = await createTeamsMeeting(accessToken, {
      subject: meetingSubject,
    });

    // Store meeting↔room mapping in local DB
    if (roomId) {
      try {
        await initMeetingRoomsSchema();
        await createMeetingRoom({
          room_id: roomId,
          meeting_id: meeting.id,
          join_web_url: meeting.joinWebUrl,
          subject: meeting.subject,
          start_date_time: meeting.startDateTime,
          end_date_time: meeting.endDateTime,
          created_by: userId,
          created_by_name: userName,
        });
      } catch (dbErr) {
        console.error("Failed to save meeting-room mapping:", dbErr);
        // Non-fatal — meeting was still created in Teams
      }
    }

    return NextResponse.json({
      meeting: {
        id: meeting.id,
        joinWebUrl: meeting.joinWebUrl,
        joinUrl: meeting.joinUrl,
        subject: meeting.subject,
        startDateTime: meeting.startDateTime,
        endDateTime: meeting.endDateTime,
      },
      roomId: roomId ?? null,
    });
  } catch (err: unknown) {
    console.error("POST /api/teams/meeting error:", err);
    const message =
      err instanceof Error ? err.message : "Kunne ikke oprette Teams møde";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ── GET /api/teams/meeting — get active meeting for current user ─────────

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    const accessToken = session.accessToken;
    if (!accessToken) {
      return NextResponse.json({ meeting: null });
    }

    const { searchParams } = new URL(req.url);
    const meetingId = searchParams.get("id");

    if (!meetingId) {
      return NextResponse.json({ meeting: null });
    }

    const meeting = await getTeamsMeeting(accessToken, meetingId);

    if (!meeting) {
      return NextResponse.json({ meeting: null });
    }

    return NextResponse.json({
      meeting: {
        id: meeting.id,
        joinWebUrl: meeting.joinWebUrl,
        joinUrl: meeting.joinUrl,
        subject: meeting.subject,
        startDateTime: meeting.startDateTime,
        endDateTime: meeting.endDateTime,
      },
    });
  } catch (err: unknown) {
    console.error("GET /api/teams/meeting error:", err);
    return NextResponse.json({ error: "Kunne ikke hente mødeinfo" }, { status: 500 });
  }
}

// ── DELETE /api/teams/meeting — end a meeting ────────────────────────────

export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const meetingId = searchParams.get("id");

    if (!meetingId) {
      return NextResponse.json({ error: "Manglende meeting ID" }, { status: 400 });
    }

    // Verify the meeting exists and user is the creator
    const meeting = await getMeetingRoom(meetingId);
    if (!meeting) {
      return NextResponse.json({ error: "Møde ikke fundet" }, { status: 404 });
    }

    await initMeetingRoomsSchema();
    await deactivateMeeting(meetingId);

    return NextResponse.json({ ok: true, message: "Møde afsluttet" });
  } catch (err: unknown) {
    console.error("DELETE /api/teams/meeting error:", err);
    return NextResponse.json({ error: "Kunne ikke afslutte møde" }, { status: 500 });
  }
}