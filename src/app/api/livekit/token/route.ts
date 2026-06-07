// VirtualOffice — LiveKit token generation endpoint
// POST /api/livekit/token
// Body: { roomName: string, participantName: string }
// Returns: { token: string, serverUrl: string }

import { AccessToken } from "livekit-server-sdk";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const serverUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;

    // Check credentials are configured
    if (!apiKey || !apiSecret || !serverUrl) {
      return NextResponse.json(
        {
          error:
            "LiveKit not configured — set LIVEKIT_API_KEY, LIVEKIT_API_SECRET, and NEXT_PUBLIC_LIVEKIT_URL in .env.local",
        },
        { status: 500 },
      );
    }

    const body = await request.json();
    const { roomName, participantName } = body;

    if (!roomName || !participantName) {
      return NextResponse.json(
        { error: "roomName and participantName are required" },
        { status: 400 },
      );
    }

    // Sanitize inputs
    const safeRoomName = roomName.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64);
    const safeParticipantName = participantName.slice(0, 128);

    // Create token with room join + publish permissions
    const token = new AccessToken(apiKey, apiSecret, {
      identity: safeParticipantName,
      name: safeParticipantName,
    });

    token.addGrant({
      room: safeRoomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true, // needed for position sync via data channel
    });

    const jwt = await token.toJwt();

    return NextResponse.json({
      token: jwt,
      serverUrl,
      roomName: safeRoomName,
    });
  } catch (error) {
    console.error("LiveKit token error:", error);
    return NextResponse.json(
      { error: "Failed to generate LiveKit token" },
      { status: 500 },
    );
  }
}