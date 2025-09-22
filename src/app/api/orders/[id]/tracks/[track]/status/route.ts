import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import type { Track, TrackStatus } from "@prisma/client";

type Params = { id: string; track: "A" | "B" };

export async function POST(
  req: Request,
  ctx: { params: Promise<Params> }
) {
  const { id, track } = await ctx.params;                // A eller B
  const { status } = (await req.json()) as { status: TrackStatus };

  // 1) Hämta ordern men bara om den inte är arkiverad
  const order = await prisma.order.findFirst({
    where: {
      orderNumber: id,
      billingConfirmedAt: null,      // ⬅️ NYTT: blockera arkiverade
    },
    select: { orderNumber: true },
  });

  if (!order) {
    return NextResponse.json(
      { error: "Order saknas eller är redan fakturerad" },
      { status: 404 }
    );
  }

  // 2) Upsert på kombon (orderId, track)
  const updated = await prisma.orderTrack.upsert({
    where: {
      // @@unique([orderId, track]) → "orderId_track"
      orderId_track: { orderId: order.orderNumber, track: track as Track },
    },
    update: { status: status as TrackStatus },
    create: {
      orderId: order.orderNumber,
      track: track as Track,
      status: status as TrackStatus,
    },
  });

  return NextResponse.json({ ok: true, track: updated });
}
