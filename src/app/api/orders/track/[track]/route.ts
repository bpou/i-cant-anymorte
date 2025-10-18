// src/app/api/orders/track/[track]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Track, TrackStatus } from "@prisma/client";
import { normalizeTrack } from "@/lib/tracks";

type Params = { track: string };

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  _req: Request,
  ctx: { params: Promise<Params> }
) {
  const { track } = await ctx.params;
  const normalized = normalizeTrack(track);

  if (!normalized) {
    return NextResponse.json({ error: "Ogiltigt spår" }, { status: 400 });
  }

  let rows: Awaited<ReturnType<typeof prisma.orderTrack.findMany>>;
  try {
    rows = await prisma.orderTrack.findMany({
      where: {
        track: normalized as Track,
        order: {
          billingConfirmedAt: null,
        },
      },
      include: {
        order: {
          select: {
            orderNumber: true,
            title: true,
            customerName: true,
            createdAt: true,
            billingConfirmedAt: true,
          },
        },
      },
      orderBy: { order: { createdAt: "desc" } },
    });
  } catch (error) {
    console.error(`[orders/track/${normalized}]`, error);
    return NextResponse.json(
      { error: "Kunde inte hämta order-spår" },
      { status: 500 }
    );
  }

  const STATI = ["INKOMMANDE", "PAGAENDE", "LEVERANS", "AVSLUTAD"] as const;
  type Status = typeof STATI[number];

  const grouped: Record<Status, typeof rows> = {
    INKOMMANDE: [],
    PAGAENDE: [],
    LEVERANS: [],
    AVSLUTAD: [],
  };

  for (const r of rows) {
    const s = r.status as TrackStatus;
    const key = (STATI.includes(s as Status) ? (s as Status) : "INKOMMANDE") as Status;
    grouped[key].push(r);
  }

  return NextResponse.json(
    { track: normalized, grouped },
    { headers: { "Cache-Control": "no-store" } }
  );
}