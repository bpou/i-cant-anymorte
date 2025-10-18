// src/app/api/fortnox/articles/route.ts
import { NextRequest, NextResponse } from "next/server";
import { listFortnoxArticles } from "@/lib/fortnox";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const qParam        = searchParams.get("q") ?? undefined;
  const articleNumber = searchParams.get("articleNumber") ?? undefined;
  const page          = Number(searchParams.get("page") ?? 1);
  const limit         = Number(searchParams.get("limit") ?? 50);
  const tenantId      = searchParams.get("tenantId") ?? undefined;

  // Build a query Fortnox understands — prefer explicit articleNumber if provided
  // Adjust the syntax if your fortnox client expects something else.
  const query =
    articleNumber && articleNumber.trim() !== ""
      ? `articlenumber:${articleNumber.trim()}`
      : qParam && qParam.trim() !== ""
      ? qParam.trim()
      : undefined;

  try {
    const { items } = await listFortnoxArticles({
      query,
      page,
      limit,
      tenantId,
    });
    return NextResponse.json({ articles: items ?? [] });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Fortnox articles error" },
      { status: 500 }
    );
  }
}
