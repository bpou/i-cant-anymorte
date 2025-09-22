// src/app/api/fortnox/customers/route.ts
import { NextRequest, NextResponse } from "next/server";
import { listFortnoxCustomers } from "@/lib/fortnox";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q") ?? "";
  const page = Number(searchParams.get("page") ?? 1);
  const limit = Number(searchParams.get("limit") ?? 50);
  const tenantId = searchParams.get("tenantId") ?? undefined;

  try {
    const { items } = await listFortnoxCustomers({ query, page, limit, tenantId });
    return NextResponse.json({ customers: items });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Fortnox customers error" }, { status: 500 });
  }
}
