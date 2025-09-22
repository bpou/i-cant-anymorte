// src/app/api/fortnox/oauth/callback/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state"); // valfritt att verifiera

  if (!code) {
    return NextResponse.json({ ok: false, error: "Missing code" }, { status: 400 });
  }

  const clientId = process.env.FORTNOX_CLIENT_ID!;
  const clientSecret = process.env.FORTNOX_CLIENT_SECRET!;
  const redirectUri = process.env.FORTNOX_REDIRECT_URI!; // måste matcha exakt

  const tokenRes = await fetch("https://apps.fortnox.se/oauth-v1/token", {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${clientId}:${clientSecret}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });

  const text = await tokenRes.text();
  if (!tokenRes.ok) {
    return NextResponse.json({ ok: false, error: `Token exchange failed: ${text}` }, { status: 500 });
  }

  let json: {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: "Bearer";
    scope?: string;
  };
  try {
    json = JSON.parse(text);
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON from Fortnox: " + text }, { status: 500 });
  }

  const expiresAt = new Date(Date.now() + (json.expires_in ?? 3600) * 1000);

  // Spara på ditt valda tenantId (ex. STUNTAB)
  const TENANT_ID = process.env.FORTNOX_DEFAULT_TENANT_ID ?? "STUNTAB";

  await prisma.fortnoxConnection.upsert({
    where: { tenantId: TENANT_ID },
    create: {
      tenantId: TENANT_ID,
      accessToken: json.access_token,
      refreshToken: json.refresh_token,
      expiresAt,
    },
    update: {
      accessToken: json.access_token,
      refreshToken: json.refresh_token,
      expiresAt,
      updatedAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true, tenantId: TENANT_ID, hasRefresh: !!json.refresh_token });
}
