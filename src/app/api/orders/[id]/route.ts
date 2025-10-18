import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { s3PresignGetUrl } from "@/lib/s3";
import type { OrderTrack } from "@prisma/client";
import { Role } from "@prisma/client";
import { TRACK_TEAM_ROLE, isAppTrack } from "@/lib/tracks";

export const runtime = "nodejs";
const FILE_URL_TTL_SEC = 600;

function canViewOrder(role: Role | undefined, tracks: Pick<OrderTrack, "track">[]): boolean {
  if (!role) return false;
  if (role === Role.ADMIN || role === Role.SALJARE) return true;
  return tracks.some((t) => {
    if (t.track === "SHARED") return true;
    if (isAppTrack(t.track)) {
      const required = TRACK_TEAM_ROLE[t.track];
      return !!required && role === required;
    }
    return false;
  });
}

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id: orderId } = await ctx.params;

  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const role = (session.user as any)?.role as Role | undefined;

  const order = await prisma.order.findUnique({
    where: { orderNumber: orderId },
    include: {
      tracks: true,
      files: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!order) {
    if (role !== Role.ADMIN && role !== Role.SALJARE) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else if (!canViewOrder(role, order.tracks)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const files = order
    ? order.files
    : await prisma.file.findMany({
        where: { orderId },
        orderBy: { createdAt: "desc" },
      });

  const now = Date.now();

  const signed = await Promise.all(
    files.map(async (f) => {
      const key = f.url; // we stored the S3 key in the url field
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
    order?.tracks?.map((t: OrderTrack) => ({
      track: t.track,   // t.track is of enum type Prisma.Track
      status: t.status, // t.status is of enum type Prisma.TrackStatus
      timeSpentMinutes: t.timeSpentMinutes ?? 0,
    })) ??
    ([
      { track: "A", status: "INKOMMANDE", timeSpentMinutes: 0 },
      { track: "B", status: "INKOMMANDE", timeSpentMinutes: 0 },
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
