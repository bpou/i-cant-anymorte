import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Track } from "@prisma/client";
import { pusherServer } from "@/lib/pusher-server";
import { s3UploadObject, s3PresignGetUrl } from "@/lib/s3";
import path from "path";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

const FILE_URL_TTL_SEC = 600; // 10 min

type Ctx = { params: Promise<{ id: string }> };

function sanitize(name: string) {
  const { name: base, ext } = path.parse(name);
  const safe =
    (base || "file")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9-_]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase() || "file";
  return { base: safe, ext: ext || "" };
}

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const { id: orderId } = await ctx.params;
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const trackStr = (form.get("track") as string) || "SHARED";

    if (!orderId || !file) {
      return NextResponse.json({ error: "Missing orderId or file" }, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const { base, ext } = sanitize(file.name);
    const key = `orders/${orderId}/${randomUUID()}-${base}${ext || ""}`;

    await s3UploadObject({
      key,
      body: buf,
      contentType: file.type || "application/octet-stream",
    });

    // ⬇️ Spara KEY i "url"-kolumnen (eller lägg en egen kolumn om du vill)
    const saved = await prisma.file.create({
      data: {
        orderId,
        filename: `${base}${ext || ""}`,
        url: key, // <— vi lagrar NYCKELN här
        track: trackStr as Track,
      },
    });

    const signedUrl = await s3PresignGetUrl(key, FILE_URL_TTL_SEC);
    const payload = {
      id: saved.id,
      filename: saved.filename,
      url: signedUrl,
      track: saved.track as "A" | "B" | "SHARED",
      createdAt: saved.createdAt.toISOString(),
      expiresAt: Date.now() + FILE_URL_TTL_SEC * 1000,
    };

    await pusherServer.trigger(`order-${orderId}`, "file:created", payload);
    return NextResponse.json({ ok: true, file: payload });
  } catch (err) {
    console.error("UPLOAD ERROR", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
