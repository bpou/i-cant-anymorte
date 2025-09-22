// src/app/api/orders/summary/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Track, TrackStatus } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Summary = Partial<Record<TrackStatus, number>>;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const track = searchParams.get("track") as Track | null;

  const whereBase = {
    order: { billingConfirmedAt: null }, // ⬅️ bara aktiva orders
  } as const;

  const where = track ? { ...whereBase, track } : whereBase;

  // totals (antal spår per status)
  const grouped = await prisma.orderTrack.groupBy({
    by: ["status"],
    where,
    _count: { _all: true },
  });

  const summary: Summary = { INKOMMANDE: 0, PAGAENDE: 0, LEVERANS: 0, AVSLUTAD: 0 };
  for (const row of grouped) summary[row.status] = row._count._all;

  // “hela/olika/individuella”-räkning ska också ignorera arkiverade orders:
  const tracks = await prisma.orderTrack.findMany({
    where: {
      track: { in: ["A", "B"] },
      order: { billingConfirmedAt: null }, // ⬅️ viktigt
    },
    select: { orderId: true, track: true, status: true },
  });

  const orderMap = new Map<string, { A?: TrackStatus; B?: TrackStatus }>();
  for (const t of tracks) {
    const cur = orderMap.get(t.orderId) ?? {};
    if (t.track === "A") cur.A = t.status;
    if (t.track === "B") cur.B = t.status;
    orderMap.set(t.orderId, cur);
  }

  const individuals: Summary = { INKOMMANDE: 0, PAGAENDE: 0, LEVERANS: 0, AVSLUTAD: 0 };
  for (const [, s] of orderMap) {
    if (s.A && s.B && s.A === s.B) individuals[s.A]! += 1;
  }

  return NextResponse.json({ summary, individuals }, { headers: { "Cache-Control": "no-store" } });
}
