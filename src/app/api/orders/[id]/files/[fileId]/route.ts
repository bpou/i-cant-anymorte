import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { pusherServer } from "@/lib/pusher-server";
import { s3DeleteObject } from "@/lib/s3";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string; fileId: string }> };

// Derivera S3-key från URL: https://bucket.s3.region.amazonaws.com/<KEY>
function keyFromS3Url(url: string) {
  const u = new URL(url);
  // u.pathname börjar med "/"
  return decodeURIComponent(u.pathname.replace(/^\/+/, ""));
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    const { id: orderId, fileId } = await ctx.params;

    const file = await prisma.file.findUnique({ where: { id: fileId } });
    if (!file || file.orderId !== orderId) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Försök radera S3-objektet
    try {
      const key = keyFromS3Url(file.url);
      await s3DeleteObject(key);
    } catch (e) {
      // OK att ignorera om objektet redan är borta / fel i test
      console.warn("S3 delete warning:", e);
    }

    await prisma.file.delete({ where: { id: fileId } });

    await pusherServer.trigger(`order-${orderId}`, "file:deleted", { id: fileId });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE file error", err);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
