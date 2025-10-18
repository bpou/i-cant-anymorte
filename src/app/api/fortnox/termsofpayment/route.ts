import { NextRequest, NextResponse } from "next/server";
import { listFortnoxTermsOfPayment } from "@/lib/fortnox";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const page = Number(searchParams.get("page") ?? 1);
  const limit = Number(searchParams.get("limit") ?? 100);
  const tenantId = searchParams.get("tenantId") ?? undefined;

  try {
    const { items } = await listFortnoxTermsOfPayment({ page, limit, tenantId });
    return NextResponse.json({ termsOfPayment: items });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Fortnox terms of payment error" },
      { status: 500 }
    );
  }
}
