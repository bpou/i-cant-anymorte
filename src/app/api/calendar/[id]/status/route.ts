import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { TrackStatus, Track } from "@prisma/client";
import { getSessionAndRole, canAccessCalendarTrack } from "@/lib/calendar-access";

const ALLOWED: TrackStatus[] = ["PAGAENDE", "PALACK", "LEVERANS", "AVSLUTAD"];

type ParamsPromise = Promise<{ id: string }>;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function PATCH(req: NextRequest, ctx: { params: ParamsPromise }) {
  const { id } = await ctx.params;
  const { status, track } = (await req.json()) as { status: TrackStatus; track: Track };

  const { session, role } = await getSessionAndRole();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!role) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!ALLOWED.includes(status)) {
    return NextResponse.json(
      { error: "Only PAGAENDE/PALACK/LEVERANS/AVSLUTAD can be set from calendar" },
      { status: 400 }
    );
  }

  const evt = await prisma.calendarEvent.findUnique({
    where: { id },
    select: { orderId: true, track: true },
  });

  if (!evt) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  if (!canAccessCalendarTrack(role, evt.track)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (track && track !== evt.track) {
    return NextResponse.json({ error: "Track mismatch for this event" }, { status: 400 });
  }

  await prisma.orderTrack.update({
    where: { orderId_track: { orderId: evt.orderId, track: evt.track } },
    data: {
      status,
      calendarLabel: null,
    },
  });

  return NextResponse.json({ ok: true });
}
