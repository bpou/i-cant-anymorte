import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Track } from "@prisma/client";
import { createFortnoxOrder, uploadFortnoxOrderConfirmation } from "@/lib/fortnox";

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

// ====== Safe body parser (fixar "Unexpected end of JSON input") ======
async function parseJsonBody(req: NextRequest): Promise<any> {
  const text = await req.text();
  if (!text || !text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch (e: any) {
    throw new Error(`Invalid JSON body. ${e?.message ?? ""}`);
  }
}

// ====== GET – oförändrad logik ======
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
    include: { tracks: true, fortnox: true, events: true, files: true, createdBy: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ orders });
}

// ====== POST – Fortnox först, använd deras DocumentNumber som orderNumber ======
export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await parseJsonBody(req); // ✅ robust mot tom/icke-JSON
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Invalid JSON" }, { status: 400 });
  }

  const session = await getServerSession(authOptions);
  const sessionUser = session?.user as { id?: string | null; name?: string | null; email?: string | null } | undefined;
  const createdById = typeof sessionUser?.id === "string" ? sessionUser.id : null;
  const createdByName = (() => {
    const name = typeof sessionUser?.name === "string" ? sessionUser.name.trim() : "";
    if (name) return name;
    const email = typeof sessionUser?.email === "string" ? sessionUser.email.trim() : "";
    return email || null;
  })();

  let {
    // gamla fält (behåller stöd)
    title, customerName, dueDate, deliveryMethod, deliveryAddress,
    deliveryName, deliveryAddress2, deliveryZip, deliveryCity, deliveryCountry,

    tracks, colorA = "#16a34a", colorB = "#ec4899",

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



  type Slot = { start: Date; end: Date };

  const parseSlot = (raw: { start?: string; end?: string } | undefined): Slot | null => {
    if (!raw?.start || !raw?.end) return null;
    const start = new Date(raw.start);
    const end = new Date(raw.end);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      return null;
    }
    return { start, end };
  };

  const minutesOr = (value: unknown, fallback: number) => {
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0) return fallback;
    const rounded = Math.round(num);
    const clamped = Math.min(Math.max(rounded, 15), 8 * 60); // mellan 15 min och 8 h
    return clamped;
  };

  let scheduleA: Slot | null = null;
  let scheduleB: Slot | null = null;

  if (autoSchedule) {
    if (tracks.includes("A")) {
      const slot = await findEarliestSlot("A", minutesOr(estimateA, 60));
      if (!slot) {
        return NextResponse.json(
          { error: "Kunde inte hitta ledig tid for spar A. Valj tid manuellt." },
          { status: 409 }
        );
      }
      scheduleA = slot;
    }
    if (tracks.includes("B")) {
      const slot = await findEarliestSlot("B", minutesOr(estimateB, 60));
      if (!slot) {
        return NextResponse.json(
          { error: "Kunde inte hitta ledig tid for spar B. Valj tid manuellt." },
          { status: 409 }
        );
      }
      scheduleB = slot;
    }
  } else {
    scheduleA = tracks.includes("A") ? parseSlot(manualA) : null;
    scheduleB = tracks.includes("B") ? parseSlot(manualB) : null;

    if (tracks.includes("A") && !scheduleA) {
      return NextResponse.json({ error: "Start/slut saknas for spar A." }, { status: 400 });
    }
    if (tracks.includes("B") && !scheduleB) {
      return NextResponse.json({ error: "Start/slut saknas for spar B." }, { status: 400 });
    }
  }

  // ---------------------------
  // 2) Normalisera leveransadress från gamla + nya fält
  // ---------------------------
  const normDelivery = {
    name: (f.DeliveryName ?? deliveryName ?? customerName ?? title) || "",
    // deliveryStreet (nytt) vinner över gamla deliveryAddress
    address1: (f.DeliveryAddress1 ?? body.deliveryStreet ?? deliveryAddress ?? "").toString(),
    address2: (f.DeliveryAddress2 ?? deliveryAddress2 ?? body.deliveryAddress ?? "").toString(), // fri text
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
  // 5) Spara lokalt
  // ---------------------------
  const orderNumber = fortnoxDoc;

  const eventTitleBase = title || `Order ${orderNumber}`;
  const eventTitle = customerName ? `${eventTitleBase} - ${customerName}` : eventTitleBase;

  const locationParts: string[] = [];
  if (body.deliveryName) {
    locationParts.push(String(body.deliveryName));
  }
  const primaryAddress = body.deliveryStreet ?? deliveryAddress ?? body.deliveryAddress;
  if (primaryAddress) {
    locationParts.push(String(primaryAddress));
  }
  const secondaryAddress = body.deliveryAddress2 ?? deliveryAddress2;
  if (secondaryAddress) {
    locationParts.push(String(secondaryAddress));
  }
  const zipCity = [body.deliveryZip ?? deliveryZip, body.deliveryCity ?? deliveryCity]
    .filter(Boolean)
    .join(" ");
  if (zipCity) {
    locationParts.push(zipCity);
  }
  const eventLocation = Array.from(new Set(locationParts.map((p) => p.trim()).filter(Boolean))).join(", ");

  const calendarEventsData = [
    ...(scheduleA
      ? [
          {
            track: Track.A,
            start: scheduleA.start,
            end: scheduleA.end,
            title: eventTitle,
            notes: eventLocation || null,
          },
        ]
      : []),
    ...(scheduleB
      ? [
          {
            track: Track.B,
            start: scheduleB.start,
            end: scheduleB.end,
            title: eventTitle,
            notes: eventLocation || null,
          },
        ]
      : []),
  ];


  const order = await prisma.order.create({
    data: {
      orderNumber,
      title,
      customerName,
      dueDate: toDateOrNull(dueDate),
      deliveryMethod,
      deliveryAddress: eventLocation || deliveryAddress, // samla adress i klartext
      createdById,
      createdByName: createdByName ?? null,
      tracks: {
        create: [
          ...(tracks.includes("A")
            ? [
                {
                  track: Track.A,
                  colorHex: colorA,
                  plannedStartAt: scheduleA?.start ?? null,
                  plannedEndAt: scheduleA?.end ?? null,
                },
              ]
            : []),
          ...(tracks.includes("B")
            ? [
                {
                  track: Track.B,
                  colorHex: colorB,
                  plannedStartAt: scheduleB?.start ?? null,
                  plannedEndAt: scheduleB?.end ?? null,
                },
              ]
            : []),
        ],
      },
      ...(calendarEventsData.length ? { events: { create: calendarEventsData } } : {}),
    },
  });

  // Länktabell (valfritt)
  try {
    await prisma.fortnoxOrderLink.create({
      data: { orderId: order.orderNumber, documentNumber: fortnoxDoc },
    });
  } catch {
    // svälj tyst – tabellen kan saknas i vissa miljöer
  }

  // ---------------------------
  // 6) Hämta & ladda upp PDF direkt (robust helper) – svälj fel
  // ---------------------------
  let fileKey: string | undefined;
  let fileId: string | undefined;
  try {
    const uploaded = await uploadFortnoxOrderConfirmation(fortnoxDoc, tenantId);
    // helper kan returnera { key } eller { key, fileId } beroende på version
    fileKey = (uploaded as any)?.key;
    fileId = (uploaded as any)?.fileId;
  } catch (e) {
    console.warn("Fortnox PDF sync misslyckades:", e);
  }

  return NextResponse.json(
    {
      ok: true,
      order,
      fortnox: { documentNumber: fortnoxDoc },
      file: fileKey ? { key: fileKey, id: fileId ?? null } : null,
      schedule: {
        A: scheduleA
          ? { start: scheduleA.start.toISOString(), end: scheduleA.end.toISOString() }
          : null,
        B: scheduleB
          ? { start: scheduleB.start.toISOString(), end: scheduleB.end.toISOString() }
          : null,
      },
    },
    { status: 200 }
  );
}
