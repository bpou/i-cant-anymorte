// src/app/api/calendar/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { CalendarEvent } from "@prisma/client"; // ✅ hämta modell-typ

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rawTrack = searchParams.get("track");
  const track = rawTrack ? rawTrack.toUpperCase() : null; // "A" | "B"

  if (!track || (track !== "A" && track !== "B")) {
    return NextResponse.json(
      { error: "Missing or invalid track" },
      { status: 400 }
    );
  }

  // Typa exakt det vi hämtar
  type EventRow = Pick<
    CalendarEvent,
    "id" | "title" | "start" | "end" | "orderId"
  >;

  const events: EventRow[] = await prisma.calendarEvent.findMany({
    where: { track },
    select: { id: true, title: true, start: true, end: true, orderId: true },
    orderBy: { start: "asc" },
  });

  const fc = events.map((e) => ({
    id: e.id,
    title: e.title ?? "",
    start: e.start?.toISOString(),
    end: e.end?.toISOString(),
    url: e.orderId ? `/orders/${e.orderId}` : undefined,
  }));

  return NextResponse.json({ events: fc });
}
