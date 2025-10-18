import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { pusherServer } from "@/lib/pusher-server";
import { s3DeleteObject } from "@/lib/s3";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string; fileId: string }> };

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    const { id: orderId, fileId } = await ctx.params;

    const file = await prisma.file.findUnique({ where: { id: fileId } });
    if (!file || file.orderId !== orderId) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Attempt to delete the backing S3 object, but swallow missing-object errors.
    try {
      await s3DeleteObject(file.url);
    } catch (e) {
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
