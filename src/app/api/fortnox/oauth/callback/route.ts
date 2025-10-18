// src/app/api/fortnox/oauth/callback/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

type StatePayload = { tenantId?: string };

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const stateRaw = url.searchParams.get("state");

  if (!code) {
    return NextResponse.json({ ok: false, error: "Missing code" }, { status: 400 });
  }
  if (!stateRaw) {
    return NextResponse.json({ ok: false, error: "Missing state" }, { status: 400 });
  }

  // Du skickade state som JSON-sträng i start-URL:en
  let state: StatePayload = {};
  try {
    state = JSON.parse(decodeURIComponent(stateRaw));
  } catch {
    // Om något blev konstigt, låt det falla tillbaka på env
  }

  const TENANT_ID =
    state.tenantId || process.env.FORTNOX_DEFAULT_TENANT_ID || "DEFAULT";

  const clientId = process.env.FORTNOX_CLIENT_ID!;
  const clientSecret = process.env.FORTNOX_CLIENT_SECRET!;
  const redirectUri = process.env.FORTNOX_REDIRECT_URI!;

  // Byt code -> access/refresh token
  const tokenRes = await fetch("https://apps.fortnox.se/oauth-v1/token", {
    method: "POST",
    headers: {
      Authorization:
        "Basic " + Buffer.from(`${clientId}:${clientSecret}`).toString("base64"),
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
    return NextResponse.json(
      { ok: false, error: `Token exchange failed: ${text}` },
      { status: 500 }
    );
  }

  let json: {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    token_type: "Bearer";
    scope?: string;
  };
  try {
    json = JSON.parse(text);
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON from Fortnox: " + text },
      { status: 500 }
    );
  }

  const expiresAt = new Date(Date.now() + (json.expires_in ?? 3600) * 1000);

  // Spara/uppdatera kopplingen för tenantId
  await prisma.fortnoxConnection.upsert({
    where: { tenantId: TENANT_ID },
    create: {
      tenantId: TENANT_ID,
      accessToken: json.access_token,
      refreshToken: json.refresh_token ?? "",
      scope: json.scope ?? undefined,
      expiresAt,
    },
    update: {
      accessToken: json.access_token,
      refreshToken: json.refresh_token ?? "",
      scope: json.scope ?? undefined,
      expiresAt,
      updatedAt: new Date(),
    },
  });

  const redirectTo =
    process.env.FORTNOX_POST_LOGIN_REDIRECT ?? "/orders/overview";
  return NextResponse.redirect(new URL(redirectTo, url));
}
