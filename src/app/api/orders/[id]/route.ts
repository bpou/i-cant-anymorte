import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { s3PresignGetUrl } from "@/lib/s3";

export const runtime = "nodejs";
const FILE_URL_TTL_SEC = 600;

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id: orderId } = await ctx.params;

  const order = await prisma.order.findUnique({
    where: { orderNumber: orderId },
    include: { tracks: true, files: { orderBy: { createdAt: "desc" } } },
  });

  const files = order
    ? order.files
    : await prisma.file.findMany({ where: { orderId }, orderBy: { createdAt: "desc" } });

  const now = Date.now();
  const signed = await Promise.all(
    files.map(async (f) => {
      const key = f.url; // vi sparade nyckeln i url-fältet
      const url = await s3PresignGetUrl(key, FILE_URL_TTL_SEC);
      return {
        id: f.id,
        filename: f.filename,
        url,
        track: f.track as "A" | "B" | "SHARED",
        createdAt: f.createdAt.toISOString(),
        expiresAt: now + FILE_URL_TTL_SEC * 1000,
      };
    })
  );

  const tracks =
    order?.tracks?.map((t) => ({ track: t.track, status: t.status })) ??
    ([
      { track: "A", status: "INKOMMANDE" },
      { track: "B", status: "INKOMMANDE" },
    ] as const);

  return NextResponse.json({
    order: {
      orderNumber: order?.orderNumber ?? orderId,
      title: order?.title ?? `Order ${orderId}`,
      customerName: order?.customerName ?? null,
      tracks,
      files: signed,
    },
  });
}
