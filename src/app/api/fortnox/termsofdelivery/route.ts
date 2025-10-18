import { NextRequest, NextResponse } from "next/server";
import { listFortnoxTermsOfDelivery } from "@/lib/fortnox";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const page = Number(searchParams.get("page") ?? 1);
  const limit = Number(searchParams.get("limit") ?? 100);
  const tenantId = searchParams.get("tenantId") ?? undefined;

  try {
    const { items } = await listFortnoxTermsOfDelivery({ page, limit, tenantId });
    return NextResponse.json({ termsOfDelivery: items });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Fortnox terms of delivery error" },
      { status: 500 }
    );
  }
}
