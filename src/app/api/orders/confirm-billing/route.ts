// src/app/api/orders/confirm-billing/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: Request) {
  const { orderNumbers } = await req.json();
  if (!Array.isArray(orderNumbers) || orderNumbers.length === 0) {
    return new NextResponse("No orders provided", { status: 400 });
  }

  await prisma.order.updateMany({
    where: { orderNumber: { in: orderNumbers } },
    data: { billingConfirmedAt: new Date() }, // ⬅️ markera som arkiverad
  });

  return NextResponse.json({ ok: true });
}
