// VirtualOffice — Meeting status API
// PATCH /api/presence/status — update current user's meeting status
//   (available | in_meeting | busy)
// GET  /api/presence/status — get all user meeting statuses

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  initMeetingStatusSchema,
  updateMeetingStatus,
  getAllMeetingStatuses,
} from "@/lib/db";

export async function GET() {
  try {
    await initMeetingStatusSchema();
    const statuses = await getAllMeetingStatuses();
    return NextResponse.json({ statuses });
  } catch (err: unknown) {
    console.error("GET /api/presence/status error:", err);
    return NextResponse.json({ error: "Database fejl" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    const userId = session.user.id ?? "unknown";
    const body = await req.json();
    const { status } = body;

    if (!status || !["available", "in_meeting", "busy"].includes(status)) {
      return NextResponse.json(
        { error: "Ugyldig status. Brug: available, in_meeting, eller busy" },
        { status: 400 },
      );
    }

    await initMeetingStatusSchema();
    await updateMeetingStatus(userId, status as "available" | "in_meeting" | "busy");

    return NextResponse.json({ ok: true, status });
  } catch (err: unknown) {
    console.error("PATCH /api/presence/status error:", err);
    return NextResponse.json({ error: "Kunne ikke opdatere status" }, { status: 500 });
  }
}