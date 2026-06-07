// VirtualOffice — Active meetings listing
// GET /api/teams/meetings — list all active Teams meetings (per room)
//
// Uses the local meeting_rooms table (created via Graph API).
// No Microsoft Graph token needed for reads — meetings are cached locally.

import { NextResponse } from "next/server";
import {
  initMeetingRoomsSchema,
  getAllActiveMeetings,
} from "@/lib/db";

export async function GET() {
  try {
    await initMeetingRoomsSchema();
    const meetings = await getAllActiveMeetings();

    return NextResponse.json({ meetings });
  } catch (err: unknown) {
    console.error("GET /api/teams/meetings error:", err);
    return NextResponse.json({ error: "Kunne ikke hente møder" }, { status: 500 });
  }
}