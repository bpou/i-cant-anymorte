import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Track } from "@prisma/client";
import { createFortnoxOrder } from "@/lib/fortnox";

// ====== Planerings-hjälpare (öppettider 07–16) ======
const WORK_START_HOUR = 7;   // 07:00
const WORK_END_HOUR   = 16;  // 16:00

type Iso = string;
type IsoOrNull = string | null | undefined;

function toDateOrNull(v: IsoOrNull) {
  return v ? new Date(v) : null;
}
function setTime(d: Date, h: number, m = 0) {
  const x = new Date(d);
  x.setHours(h, m, 0, 0);
  return x;
}
function addMinutes(d: Date, mins: number) {
  return new Date(d.getTime() + mins * 60_000);
}
function clampToBusinessHours(start: Date, end: Date) {
  const sOpen = setTime(start, WORK_START_HOUR);
  const sClose = setTime(start, WORK_END_HOUR);
  let s = start < sOpen ? sOpen : start;
  let e = end > sClose ? sClose : end;
  if (s >= e) return null;
  return { start: s, end: e };
}

// Hitta första lediga lucka för ett spår ("A" | "B") som rymmer `minutes`
async function findEarliestSlot(track: "A" | "B", minutes: number) {
  let day = new Date();
  day.setSeconds(0, 0);

  // Prova upp till 30 dagar framåt
  for (let i = 0; i < 30; i++) {
    const dayOpen  = setTime(day, WORK_START_HOUR);
    const dayClose = setTime(day, WORK_END_HOUR);

    const events = await prisma.calendarEvent.findMany({
      where: { track, start: { lt: dayClose }, end: { gt: dayOpen } },
      select: { start: true, end: true },
      orderBy: { start: "asc" },
    });

    let cursor = new Date(Math.max(Date.now(), dayOpen.getTime()));
    if (cursor >= dayClose) {
      day = addMinutes(setTime(day, 0), 24 * 60);
      continue;
    }

    for (const ev of events) {
      const evStart = new Date(ev.start);
      const evEnd   = new Date(ev.end);

      if (evStart > cursor) {
        const candidateEnd = addMinutes(cursor, minutes);
        const clamped = clampToBusinessHours(cursor, candidateEnd);
        if (clamped && clamped.end <= evStart) return clamped;
      }
      if (evEnd > cursor) cursor = evEnd;
      if (cursor >= dayClose) break;
    }

    if (cursor < dayClose) {
      const candidateEnd = addMinutes(cursor, minutes);
      const clamped = clampToBusinessHours(cursor, candidateEnd);
      if (clamped && clamped.end <= dayClose) return clamped;
    }

    day = addMinutes(setTime(day, 0), 24 * 60);
  }

  return null;
}

// ====== GET – oförändrad ======
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rawTrack = searchParams.get("track");
  const track = rawTrack ? rawTrack.toUpperCase() : null;

  const rawStatus = searchParams.get("status");
  const status = rawStatus ? rawStatus.toUpperCase() : null;

  const validStatuses = ["INKOMMANDE","PAGAENDE","LEVERANS","AVSLUTAD"] as const;

  const where: any = {};
  if (track || status) {
    if (track && track !== "A" && track !== "B") {
      return NextResponse.json({ error: "Invalid track" }, { status: 400 });
    }
    if (status && !validStatuses.includes(status as any)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    where.tracks = {
      some: {
        ...(track ? { track } : {}),
        ...(status ? { status } : {}),
      },
    };
  }

  const orders = await prisma.order.findMany({
    where,
    include: { tracks: true, fortnox: true, events: true, files: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ orders });
}

// ====== POST – Fortnox först, använd deras DocumentNumber som orderNumber ======
export async function POST(req: NextRequest) {
  const body = await req.json();

  let {
    // gamla fält (behåller stöd)
    title, customerName, dueDate, deliveryMethod, deliveryAddress,
    deliveryName, deliveryAddress2, deliveryZip, deliveryCity, deliveryCountry,

    tracks, plannedA, plannedB, colorA = "#16a34a", colorB = "#ec4899",

    // planering
    autoSchedule = true,
    estimateA, estimateB,
    manualA, manualB,

    // multitenant
    tenantId,

    // Fortnox-kopplat
    customerNumber,
    orderRows,               // gamla rader (lowercase)
    fortnox: fortnoxFromClient, // nya fält (Uppercase-keys för Fortnox)
  } = body;

  const f = fortnoxFromClient ?? {};

  tracks = Array.isArray(tracks) ? tracks.map((t: string) => (t || "").toUpperCase()) : [];

  if (!title) {
    return NextResponse.json({ error: "title krävs" }, { status: 400 });
  }
  if (!(customerNumber || f.CustomerNumber)) {
    return NextResponse.json({ error: "customerNumber krävs (Fortnox-kund)" }, { status: 400 });
  }

  // ---------------------------
  // 1) Bygg Fortnox OrderRows
  // ---------------------------
  let rows:
    | Array<{
        ArticleNumber?: string;
        Description?: string;
        OrderedQuantity: number;
        Price: number;
        Unit?: string;
      }>
    | undefined;

  if (Array.isArray(f.OrderRows) && f.OrderRows.length) {
    // Nya vägen: redan i Fortnox-format
    rows = f.OrderRows.map((r: any) => ({
      ArticleNumber: r.ArticleNumber,
      Description: r.Description ?? title,
      OrderedQuantity: Number(r.OrderedQuantity ?? 1),
      Price: Number(r.Price ?? 0),
      Unit: r.Unit || "st",
    }));
  } else if (Array.isArray(orderRows) && orderRows.length) {
    // Gamla vägen: mappa lowercase -> Fortnox
    rows = orderRows.map((r: any) => ({
      ArticleNumber: r.articleNumber || undefined,
      Description: r.description || title,
      OrderedQuantity: Number(r.OrderedQuantity ?? 1),
      Price: Number(r.price ?? 0),
      Unit: r.unit || "st",
    }));
  } else {
    // default
    rows = [
      {
        Description: title,
        OrderedQuantity: 1,
        Price: 0,
        Unit: "st",
      },
    ];
  }

  // ---------------------------
  // 2) Normalisera leveransadress från gamla + nya fält
  // ---------------------------
  const normDelivery = {
    name: (f.DeliveryName ?? deliveryName ?? customerName ?? title) || "",
    // deliveryStreet från nya sidan vinner över gamla deliveryAddress
    address1: (f.DeliveryAddress1 ?? body.deliveryStreet ?? deliveryAddress ?? "").toString(),
    address2: (f.DeliveryAddress2 ?? deliveryAddress2 ?? body.deliveryAddress ?? "").toString(), // fri textfält
    zip: (f.DeliveryZipCode ?? deliveryZip ?? "").toString(),
    city: (f.DeliveryCity ?? deliveryCity ?? "").toString(),
    way: f.WayOfDelivery ?? body.wayOfDelivery ?? deliveryMethod,
  };

  // ---------------------------
  // 3) Fortnox payload (merge nya fält + bakåtkomp.)
  // ---------------------------
  const fortnoxPayload: any = {
    CustomerNumber: String(f.CustomerNumber ?? customerNumber),
    // datum
    OrderDate: f.OrderDate ?? new Date().toISOString().slice(0, 10),
    ...(f.DeliveryDate ? { DeliveryDate: f.DeliveryDate } : {}),

    // referenser/pris
    ...(f.OurReference || body.ourReference ? { OurReference: f.OurReference ?? body.ourReference } : {}),
    ...(f.YourReference || customerName || title ? { YourReference: f.YourReference ?? customerName ?? title } : {}),
    ...(f.PriceList || body.priceList ? { PriceList: f.PriceList ?? body.priceList } : {}),
    ...(typeof f.VATIncluded === "boolean"
      ? { VATIncluded: f.VATIncluded }
      : typeof body.pricesInclVAT === "boolean"
      ? { VATIncluded: body.pricesInclVAT }
      : {}),

    // faktura/kundadress
    ...(f.CustomerName || body.invoiceName ? { CustomerName: f.CustomerName ?? body.invoiceName } : {}),
    ...(f.Address1 || body.invoiceAddress1 ? { Address1: f.Address1 ?? body.invoiceAddress1 } : {}),
    ...(f.Address2 || body.invoiceAddress2 ? { Address2: f.Address2 ?? body.invoiceAddress2 } : {}),
    ...(f.ZipCode || body.invoiceZip ? { ZipCode: f.ZipCode ?? body.invoiceZip } : {}),
    ...(f.City || body.invoiceCity ? { City: f.City ?? body.invoiceCity } : {}),
    ...(f.OrganisationNumber || body.organisationNumber
      ? { OrganisationNumber: f.OrganisationNumber ?? body.organisationNumber }
      : {}),
    ...(f.Phone1 || body.phone1 ? { Phone1: f.Phone1 ?? body.phone1 } : {}),
    ...(f.EmailInformation || body.email
      ? { EmailInformation: f.EmailInformation ?? { EmailAddressTo: body.email } }
      : {}),

    // leveransadress
    DeliveryName: normDelivery.name,
    ...(normDelivery.address1 ? { DeliveryAddress1: normDelivery.address1 } : {}),
    ...(normDelivery.address2 ? { DeliveryAddress2: normDelivery.address2 } : {}),
    ...(normDelivery.zip ? { DeliveryZipCode: normDelivery.zip } : {}),
    ...(normDelivery.city ? { DeliveryCity: normDelivery.city } : {}),
    ...(normDelivery.way ? { WayOfDelivery: normDelivery.way } : {}),

    // visa din "Ordertitel" i remarks om du vill få med den i dokumentet
    ...(f.Remarks || title ? { Remarks: f.Remarks ?? title } : {}),

    // rader
    OrderRows: rows,
  };

  // ---------------------------
  // 4) Skapa order i Fortnox först
  // ---------------------------
  let fortnoxDoc: string;
  try {
    const { documentNumber } = await createFortnoxOrder(fortnoxPayload, tenantId);
    fortnoxDoc = documentNumber;
  } catch (err: any) {
    const msg = err?.message ?? "Okänt Fortnox-fel";
    return NextResponse.json({ ok: false, fortnoxError: msg }, { status: 400 });
  }

  // ---------------------------
  // 5) Spara lokalt (oförändrat i stort)
  // ---------------------------
  const orderNumber = fortnoxDoc;

  const order = await prisma.order.create({
    data: {
      orderNumber,
      title,
      customerName,
      dueDate: dueDate ? new Date(dueDate) : null,
      deliveryMethod,
      deliveryAddress, // din egna sammanslagna adress lokalt
      tracks: {
        create: [
          ...(tracks.includes("A")
            ? [
                {
                  track: Track.A,
                  colorHex: colorA,
                  plannedStartAt: manualA?.start
                    ? new Date(manualA.start)
                    : plannedA?.start
                    ? new Date(plannedA.start)
                    : null,
                  plannedEndAt: manualA?.end
                    ? new Date(manualA.end)
                    : plannedA?.end
                    ? new Date(plannedA?.end)
                    : null,
                },
              ]
            : []),
          ...(tracks.includes("B")
            ? [
                {
                  track: Track.B,
                  colorHex: colorB,
                  plannedStartAt: manualB?.start
                    ? new Date(manualB.start)
                    : plannedB?.start
                    ? new Date(plannedB.start)
                    : null,
                  plannedEndAt: manualB?.end
                    ? new Date(manualB.end)
                    : plannedB?.end
                    ? new Date(plannedB?.end)
                    : null,
                },
              ]
            : []),
        ],
      },
    },
  });

  // länk-tabell (valfritt)
  try {
    await prisma.fortnoxOrderLink.create({
      data: { orderId: order.orderNumber, documentNumber: fortnoxDoc },
    });
  } catch {
    // svälj tyst – tabellen kan saknas i vissa miljöer
  }

  // (valfritt) autoschema – din befintliga logik kan användas här

  return NextResponse.json({ ok: true, order, fortnox: { documentNumber: fortnoxDoc } }, { status: 200 });
}
