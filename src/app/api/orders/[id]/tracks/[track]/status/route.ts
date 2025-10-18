// src/app/api/orders/[id]/tracks/[track]/status/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import type { Track, TrackStatus } from "@prisma/client";
import { normalizeTrack } from "@/lib/tracks";

type Params = { id: string; track: string };

const VALID_STATUS: TrackStatus[] = [
  "INKOMMANDE",
  "PAGAENDE",
  "LEVERANS",
  "AVSLUTAD",
  "PALACK",
];

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

  const status = (body as { status?: TrackStatus })?.status;
  if (!status || !VALID_STATUS.includes(status)) {
    return NextResponse.json(
      { error: "Ogiltig status. Tillåtna: INKOMMANDE, PÅGÅENDE, LEVERANS, AVSLUTAD, PALACK" },
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
      update: { status },
      create: {
        orderId: order.orderNumber,
        track: normalizedTrack as Track,
        status,
      },
      select: {
        orderId: true,
        track: true,
        status: true,
        calendarLabel: true,
        plannedStartAt: true,
        plannedEndAt: true,
      },
    });

    return NextResponse.json({ ok: true, track: updated });
  } catch (error) {
    console.error(`[orders/${orderId}/tracks/${normalizedTrack}]`, error);
    return NextResponse.json(
      { error: "Kunde inte uppdatera status för spår" },
      { status: 500 }
    );
  }
}