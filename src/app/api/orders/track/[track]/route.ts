// src/app/api/orders/track/[track]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Track, TrackStatus } from "@prisma/client";

type Params = { track: "A" | "B" };

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  _req: Request,
  ctx: { params: Promise<Params> } // behåller din Promise<Params>
) {
  const { track } = await ctx.params;
  const t = track?.toUpperCase() as "A" | "B";

  if (t !== "A" && t !== "B") {
    return NextResponse.json({ error: "Ogiltigt spår" }, { status: 400 });
  }

  // ⬇️ Viktigt: Filtrera bort fakturerade (billingConfirmedAt != null)
  const rows = await prisma.orderTrack.findMany({
    where: {
      track: t as Track,
      order: {
        billingConfirmedAt: null, // ⬅️ Göm fakturerade ordrar
      },
    },
    include: {
      order: {
        select: {
          orderNumber: true,
          title: true,
          customerName: true,
          createdAt: true,
          billingConfirmedAt: true, // mest för tydlighet/typning (kan tas bort)
        },
      },
    },
    orderBy: { order: { createdAt: "desc" } },
  });

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
    { track: t, grouped },
    { headers: { "Cache-Control": "no-store" } }
  );
}
