import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Track, Role } from "@prisma/client";
import { pusherServer } from "@/lib/pusher-server";
import { s3UploadObject, s3PresignGetUrl } from "@/lib/s3";
import path from "path";
import { randomUUID } from "crypto";
import { normalizeTrack, TRACK_TEAM_ROLE, isAppTrack } from "@/lib/tracks";

export const runtime = "nodejs";

const FILE_URL_TTL_SEC = 600; // 10 min

function canManageTrack(role: Role | undefined, track: Track) {
  if (!role) return false;
  if (role === Role.ADMIN || role === Role.SALJARE) return true;
  if (track === "SHARED") return true;
  if (isAppTrack(track)) {
    const required = TRACK_TEAM_ROLE[track];
    return !!required && role === required;
  }
  return false;
}

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

    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const role = (session.user as any)?.role as Role | undefined;

    const form = await req.formData();
    const file = form.get("file") as File | null;
    const rawTrack = (form.get("track") as string) ?? "SHARED";

    if (!orderId || !file) {
      return NextResponse.json({ error: "Missing orderId or file" }, { status: 400 });
    }

    const normalizedTrack =
      rawTrack === "SHARED" ? "SHARED" : normalizeTrack(rawTrack ?? undefined);

    if (rawTrack !== "SHARED" && !normalizedTrack) {
      return NextResponse.json({ error: "Ogiltigt spår" }, { status: 400 });
    }

    const trackForSave = (normalizedTrack ?? "SHARED") as Track;

    if (!canManageTrack(role, trackForSave)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const { base, ext } = sanitize(file.name);
    const key = `orders/${orderId}/${randomUUID()}-${base}${ext || ""}`;

    await s3UploadObject({
      key,
      body: buf,
      contentType: file.type || "application/octet-stream",
    });

    const saved = await prisma.file.create({
      data: {
        orderId,
        filename: `${base}${ext || ""}`,
        url: key,
        track: trackForSave,
      },
    });

    const signedUrl = await s3PresignGetUrl(key, FILE_URL_TTL_SEC);
    const payload = {
      id: saved.id,
      filename: saved.filename,
      url: signedUrl,
      track: saved.track,
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