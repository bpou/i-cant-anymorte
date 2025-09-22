import { NextResponse } from "next/server";
import { listFortnoxPriceLists } from "@/lib/fortnox";

export async function GET() {
  try {
    const { items } = await listFortnoxPriceLists({});
    // items = [{ code, description }]
    return NextResponse.json({ items });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Unknown error" }, { status: 500 });
  }
}
