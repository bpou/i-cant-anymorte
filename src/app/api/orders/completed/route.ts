// src/app/api/orders/completed/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const orders = await prisma.order.findMany({
    where: {
      billingConfirmedAt: null,                     // ⬅️ ännu inte arkiverad
      AND: [
        { tracks: { some: { track: "A", status: "AVSLUTAD" } } },
        { tracks: { some: { track: "B", status: "AVSLUTAD" } } },
      ],
    },
    orderBy: { updatedAt: "desc" },
    select: { orderNumber: true, title: true, customerName: true, updatedAt: true },
  });

  return NextResponse.json({ orders }, { headers: { "Cache-Control": "no-store" } });
}
