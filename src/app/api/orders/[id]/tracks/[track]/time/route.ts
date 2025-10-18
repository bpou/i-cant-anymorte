import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import type { Track } from "@prisma/client";
import { normalizeTrack } from "@/lib/tracks";

type Params = { id: string; track: string };

const MAX_MINUTES_PER_REQUEST = 24 * 60; // 24 hours

export async function POST(
  req: Request,
  ctx: { params: Promise<Params> }
) {
  const p = await ctx.params;
  const orderId = p?.id;
  const normalizedTrack = normalizeTrack(p?.track);

  if (!orderId) {
    return NextResponse.json({ error: "Saknar order-id" }, { status: 400 });
  }
  if (!normalizedTrack) {
    return NextResponse.json({ error: "Ogiltigt spår" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ogiltig JSON i request body" }, { status: 400 });
  }

  const minutesRaw = Number((body as { minutes?: number })?.minutes);
  if (!Number.isFinite(minutesRaw)) {
    return NextResponse.json({ error: "Tidsvärdet måste vara ett tal" }, { status: 400 });
  }

  const minutes = Math.round(minutesRaw);
  if (minutes <= 0) {
    return NextResponse.json({ error: "Tiden måste vara större än noll" }, { status: 400 });
  }
  if (minutes > MAX_MINUTES_PER_REQUEST) {
    return NextResponse.json(
      { error: "Max 24 timmar (1 440 minuter) kan registreras åt gången" },
      { status: 400 }
    );
  }

  try {
    const order = await prisma.order.findFirst({
      where: { orderNumber: orderId, billingConfirmedAt: null },
      select: { orderNumber: true },
    });

    if (!order) {
      return NextResponse.json(
        { error: "Order saknas eller är redan fakturerad" },
        { status: 404 }
      );
    }

    const updated = await prisma.orderTrack.upsert({
      where: {
        orderId_track: { orderId: order.orderNumber, track: normalizedTrack as Track },
      },
      update: { timeSpentMinutes: { increment: minutes } },
      create: {
        orderId: order.orderNumber,
        track: normalizedTrack as Track,
        timeSpentMinutes: minutes,
      },
      select: {
        orderId: true,
        track: true,
        timeSpentMinutes: true,
      },
    });

    return NextResponse.json({ ok: true, track: updated, minutesAdded: minutes });
  } catch (error) {
    console.error(
      `[orders/${orderId}/tracks/${normalizedTrack}/time]`,
      error
    );
    return NextResponse.json(
      { error: "Kunde inte uppdatera tid för spår" },
      { status: 500 }
    );
  }
}
