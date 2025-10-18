// src/lib/fortnox.ts
import { Track } from "@prisma/client";      // Prisma enum
import { prisma } from "@/lib/prisma";       // Your PrismaClient instance
import { s3UploadObject } from "@/lib/s3";

/**
 * Fortnox REST base och OAuth-token endpoint.
 * Använd /3 (nuvarande stabila base).
 */
const API_BASE = "https://api.fortnox.se/3";
const TOKEN_URL = "https://apps.fortnox.se/oauth-v1/token";

/* ----------------------- Hjälpare ----------------------- */
function b64(s: string) {
  return Buffer.from(s).toString("base64");
}

async function fortnoxFetch(
  url: string,
  accessToken: string,
  init?: RequestInit
): Promise<{ text: string; ok: boolean; status: number }> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers || {}),
    },
  });
  const text = await res.text();
  return { text, ok: res.ok, status: res.status };
}

/** Försök parsa Fortnox-respons utan att krascha klienten. */
function safeJSON<T = any>(text: string): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error("Kunde inte parsa Fortnox-svar: " + text);
  }
}

/* ----------------------- Typer ----------------------- */
type FortnoxTokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number; // sekunder
  scope?: string;
  token_type: "Bearer";
};

type FortnoxOrderResponse = {
  Order?: {
    DocumentNumber?: string | number;
    [k: string]: unknown;
  };
  [k: string]: unknown;
};

export type FortnoxListItem = { code: string; description?: string };

/* =======================================================
   OAuth: hämta (och ev. förnya) access token för en tenant
   ======================================================= */
export async function getFortnoxAccessToken(
  tenantId?: string
): Promise<{ accessToken: string; tenantId: string }> {
  const tId = tenantId ?? process.env.FORTNOX_DEFAULT_TENANT_ID!;
  if (!tId) {
    throw new Error("Sätt FORTNOX_DEFAULT_TENANT_ID i miljön eller ange tenantId.");
  }

  const row = await prisma.fortnoxConnection.findFirst({ where: { tenantId: tId } });
  if (!row) throw new Error("FortnoxConnection saknas för tenantId=" + tId);

  const willExpireSoon =
    !row.expiresAt || row.expiresAt.getTime() < Date.now() + 5 * 60_000; // < 5 min kvar

  // Returnera cachead token om den är giltig
  if (!willExpireSoon) {
    if (!row.accessToken) throw new Error("Inget accessToken sparat för tenantId=" + tId);
    return { accessToken: row.accessToken, tenantId: row.tenantId };
  }

  // Refresh token-flödet
  const clientId = process.env.FORTNOX_CLIENT_ID!;
  const clientSecret = process.env.FORTNOX_CLIENT_SECRET!;
  if (!clientId || !clientSecret) {
    throw new Error("FORTNOX_CLIENT_ID / FORTNOX_CLIENT_SECRET saknas i miljön.");
  }

  const basic = b64(`${clientId}:${clientSecret}`);

  const params = new URLSearchParams();
  params.set("grant_type", "refresh_token");
  params.set("refresh_token", row.refreshToken);
  const redirect = process.env.FORTNOX_REDIRECT_URI;
  if (redirect) params.set("redirect_uri", redirect);

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Fortnox refresh failed (${res.status}): ${text}`);
  }

  const json = (await res.json()) as FortnoxTokenResponse;
  const expiresAt = new Date(Date.now() + (json.expires_in ?? 3600) * 1000);

  await prisma.fortnoxConnection.update({
    where: { id: row.id },
    data: {
      accessToken: json.access_token,
      refreshToken: json.refresh_token,
      expiresAt,
      updatedAt: new Date(),
    },
  });

  return { accessToken: json.access_token, tenantId: row.tenantId };
}

/* =======================================================
   Skapa order (Orders v2) och returnera DocumentNumber
   ======================================================= */
export async function createFortnoxOrder(
  payload: any,
  tenantId?: string
): Promise<{ documentNumber: string }> {
  const { accessToken } = await getFortnoxAccessToken(tenantId);

  // Fortnox Orders v2 använder "Order" som rotobjekt
  const { text, ok, status } = await fortnoxFetch(
    `${API_BASE}/orders-v2`,
    accessToken,
    {
      method: "POST",
      body: JSON.stringify({ Order: payload }),
    }
  );

  if (!ok) throw new Error(`Fortnox create order failed (${status}): ${text}`);

  const json = safeJSON<FortnoxOrderResponse>(text);
  const raw = json?.Order?.DocumentNumber;
  const documentNumber = raw != null ? String(raw) : "";
  if (!documentNumber) {
    throw new Error("Fortnox svar saknar Order.DocumentNumber: " + text);
  }
  return { documentNumber };
}

/* =======================================================
   Lista kunder
   ======================================================= */
export async function listFortnoxCustomers({
  query = "",
  page = 1,
  limit = 50,
  tenantId,
}: {
  query?: string;
  page?: number;
  limit?: number;
  tenantId?: string;
}) {
  const { accessToken } = await getFortnoxAccessToken(tenantId);

  const params = new URLSearchParams();
  if (query) {
    // Vanligt är "filter=name=QUERY"
    params.set("filter", `name=${query}`);
  }
  params.set("page", String(page));
  params.set("limit", String(limit));

  const { text, ok, status } = await fortnoxFetch(
    `${API_BASE}/customers?${params}`,
    accessToken
  );
  if (!ok) throw new Error(`Fortnox customers failed (${status}): ${text}`);

  const json: any = safeJSON(text);
  const customers = json.Customers ?? json.CustomerSubset ?? json.Items ?? [];
  const items = customers.map((c: any) => ({
    customerNumber: c.CustomerNumber ?? c.customerNumber ?? c.Number ?? "",
    name: c.Name ?? c.name ?? "",
    organisationNumber: c.OrganisationNumber ?? c.organisationNumber ?? "",
    city: c.City ?? c.city ?? "",
  }));

  return { items };
}

/* =======================================================
   Lista artiklar
   ======================================================= */
export async function listFortnoxArticles({
  query = "",
  page = 1,
  limit = 50,
  tenantId,
}: {
  query?: string;
  page?: number;
  limit?: number;
  tenantId?: string;
}) {
  const { accessToken } = await getFortnoxAccessToken(tenantId);

  const params = new URLSearchParams();
  if (query) params.set("filter", `description=${query}`);
  params.set("page", String(page));
  params.set("limit", String(limit));

  const { text, ok, status } = await fortnoxFetch(
    `${API_BASE}/articles?${params}`,
    accessToken
  );
  if (!ok) throw new Error(`Fortnox articles failed (${status}): ${text}`);

  const json: any = safeJSON(text);
  const arr = json.Articles ?? json.Items ?? [];
  const items = arr.map((a: any) => ({
    articleNumber: a.ArticleNumber ?? a.Article ?? a.Id ?? "",
    description: a.Description ?? a.Name ?? "",
    salesPrice: a.SalesPrice ?? a.Price ?? undefined,
    unit: a.Unit ?? a.UnitName ?? "",
  }));

  return { items };
}

/* =======================================================
   Lista leveranssätt (WayOfDeliveries)
   ======================================================= */
export async function listFortnoxWayOfDeliveries({
  page = 1,
  limit = 100,
  tenantId,
}: {
  page?: number;
  limit?: number;
  tenantId?: string;
}): Promise<{ items: FortnoxListItem[] }> {
  const { accessToken } = await getFortnoxAccessToken(tenantId);

  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("limit", String(limit));

  const { text, ok, status } = await fortnoxFetch(
    `${API_BASE}/wayofdeliveries?${params}`,
    accessToken
  );
  if (!ok) throw new Error(`Fortnox wayofdeliveries failed (${status}): ${text}`);

  const json: any = safeJSON(text);

  // Fortnox varierar: ibland { WayOfDeliveries: [...] }, ibland wrapper-objekt
  const arr =
    json?.WayOfDeliveries?.WayOfDelivery ??
    json?.WayOfDeliveries ??
    json?.wayOfDeliveries ??
    json?.Items ??
    [];

  const items: FortnoxListItem[] = arr
    .map((w: any) => ({
      code: w.Code ?? w.WayOfDeliveryCode ?? w.code ?? w.id ?? "",
      description: w.Description ?? w.Name ?? w.description ?? "",
    }))
    .filter((x: FortnoxListItem) => x.code);

  return { items };
}

/* =======================================================
   Skapa offert (Offers) och returnera hela Offer-objektet
   ======================================================= */
type FortnoxOfferResponse = {
  Offer?: { DocumentNumber?: string | number; [k: string]: unknown };
  [k: string]: unknown;
};

export async function createFortnoxOffer(
  payload: any,
  tenantId?: string
): Promise<any> {
  const { accessToken } = await getFortnoxAccessToken(tenantId);

  // Fortnox vill ha { Offer: ... }
  const { text, ok, status } = await fortnoxFetch(
    `${API_BASE}/offers`,
    accessToken,
    {
      method: "POST",
      body: JSON.stringify({ Offer: payload }),
    }
  );

  if (!ok) {
    throw new Error(`Fortnox create offer failed (${status}): ${text}`);
  }

  const json = safeJSON<FortnoxOfferResponse>(text);
  const offer = json?.Offer ?? (json as any)?.offer ?? json;
  return offer;
}

/* =======================================================================
   Ladda ned och lagra orderbekräftelse som PDF i S3/MinIO (legacy print)
   ======================================================================= */
export async function uploadFortnoxOrderConfirmation(
  documentNumber: string,
  tenantId?: string
): Promise<{ key: string; fileId: string }> {
  const { accessToken } = await getFortnoxAccessToken(tenantId);

  // Try a few Accept variants so Fortnox doesn’t 1000030 us
  const candidates: Array<{ url: string; headers: Record<string, string> }> = [
    { url: `${API_BASE}/orders/${documentNumber}/print`, headers: { Accept: "application/pdf" } },
    { url: `${API_BASE}/orders/${documentNumber}/print`, headers: { Accept: "application/octet-stream" } },
    { url: `${API_BASE}/orders/${documentNumber}/print`, headers: { Accept: "*/*" } },
    { url: `${API_BASE}/orders/${documentNumber}/print?format=pdf`, headers: { Accept: "application/pdf" } },
  ];

  let pdfBuffer: Buffer | null = null;
  let lastErr: string | null = null;

  for (const c of candidates) {
    try {
      const res = await fetch(c.url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Client-Secret": process.env.FORTNOX_CLIENT_SECRET || "",
          ...c.headers,
        },
        cache: "no-store",
      });
      if (!res.ok) { lastErr = `(${res.status}) ${await res.text()}`; continue; }
      const ab = await res.arrayBuffer();
      if (!ab || (ab as any).byteLength === 0) { lastErr = "Empty body."; continue; }
      pdfBuffer = Buffer.from(ab);
      break;
    } catch (e: any) {
      lastErr = e?.message || String(e);
    }
  }

  if (!pdfBuffer) {
    throw new Error(`Fortnox order print failed for ${documentNumber}. Last error: ${lastErr}`);
  }

  const key = `orders/${documentNumber}.pdf`;
  await s3UploadObject({ key, body: pdfBuffer, contentType: "application/pdf" });

  // 🔽 Upsert a File row so your GET route will list it
  const existing = await prisma.file.findFirst({
    where: { orderId: documentNumber, url: key },
    select: { id: true },
  });

  const file =
    existing ??
    (await prisma.file.create({
      data: {
        orderId: documentNumber,
        track: Track.SHARED,                 // show in both lanes
        filename: `Order-${documentNumber}.pdf`,
        url: key,                            // you store the S3 key in `url`
        uploadedBy: "system:fortnox",
      },
      select: { id: true },
    }));

  return { key, fileId: file.id };
}


/**
 * Skapa order i Fortnox (v2) och ladda direkt upp orderbekräftelse till S3,
 * samt skapa File-rad så den visas i UI:t.
 */
export async function createFortnoxOrderAndSync(
  payload: any,
  tenantId?: string
): Promise<{
  documentNumber: string;
  fileKey?: string;
  fileId?: string;
}> {
  // 1) Skapa ordern i Fortnox
  const { documentNumber } = await createFortnoxOrder(payload, tenantId);

  // 2) Försök hämta/printa PDF:n och lägga den i S3 + DB
  try {
    const { key, fileId } = await uploadFortnoxOrderConfirmation(documentNumber, tenantId);
    return { documentNumber, fileKey: key, fileId };
  } catch (err) {
    // Gör inte hela orderflödet rött bara för att PDF:en fallerar – returnera ändå
    console.warn("Fortnox PDF sync misslyckades:", err);
    return { documentNumber };
  }
}




/* =======================================================================================
   Orders v2 / okänd tenant-konfiguration: försök flera vägar och spara första PDF vi hittar
   ======================================================================================= */

async function fxFetch(url: string, accessToken: string, init?: RequestInit) {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Client-Secret": process.env.FORTNOX_CLIENT_SECRET!,
      ...(init?.headers || {}),
    },
  });
  return res;
}

async function savePdfAndUpsertFile(documentNumber: string, pdf: Buffer, name: string) {
  const key = `orders/${documentNumber}.pdf`;
  await s3UploadObject({ key, body: pdf, contentType: "application/pdf" });

  const existing = await prisma.file.findFirst({
    where: { orderId: documentNumber, url: key },
    select: { id: true },
  });

  const file =
    existing ??
    (await prisma.file.create({
      data: {
        orderId: documentNumber,
        track: Track.SHARED,
        filename: name,
        url: key,
        uploadedBy: "system:fortnox",
      },
      select: { id: true },
    }));

  return { key, fileId: file.id };
}

/**
 * Försök:
 * 1) Legacy print (om ordern är skapad via legacy API)
 * 2) v2 subroutes: /orders-v2/{doc}/attachments eller /documents
 * 3) Arkiv-sökning efter PDF som innehåller ordernumret
 */
export async function uploadFortnoxOrderConfirmationAuto(
  documentNumber: string,
  tenantId?: string
): Promise<{ key: string; fileId: string }> {
  const { accessToken } = await getFortnoxAccessToken(tenantId);

  // Try 1: legacy /orders/{doc}/print
  try {
    const p = await fxFetch(`${API_BASE}/orders/${documentNumber}/print`, accessToken, {
      method: "GET",
      headers: { Accept: "application/pdf" },
    });
    if (p.ok) {
      const pdf = Buffer.from(await p.arrayBuffer());
      return await savePdfAndUpsertFile(documentNumber, pdf, `Order-${documentNumber}.pdf`);
    }
  } catch {
    /* fallthrough */
  }

  // Try 2: v2 subresources (tenanter skiljer sig ibland i namngivning)
  for (const sub of ["attachments", "documents"]) {
    try {
      const r = await fxFetch(
        `${API_BASE}/orders-v2/${documentNumber}/${sub}`,
        accessToken,
        { method: "GET", headers: { Accept: "application/json" } }
      );
      if (!r.ok) continue;
      const json: any = await r.json();
      const list = json?.Attachments ?? json?.Documents ?? json?.Items ?? [];
      const first = Array.isArray(list) ? list[0] : undefined;
      const fileId = first?.FileId ?? first?.Id ?? first?.fileId ?? first?.id;
      const name = first?.Name ?? first?.name ?? `Order-${documentNumber}.pdf`;
      if (!fileId) continue;

      const f = await fxFetch(
        `${API_BASE}/archive/filecontents?fileid=${encodeURIComponent(fileId)}`,
        accessToken,
        { method: "GET", headers: { Accept: "application/pdf" } }
      );
      if (!f.ok) throw new Error(await f.text());
      const pdf = Buffer.from(await f.arrayBuffer());
      return await savePdfAndUpsertFile(documentNumber, pdf, name);
    } catch {
      /* try next */
    }
  }

  // Try 3: Arkiv-sök (leta PDF vars namn innehåller ordernumret)
  for (const q of [
    `searchstring=${encodeURIComponent(documentNumber)}`,
    `q=${encodeURIComponent(documentNumber)}`,
  ]) {
    try {
      const a = await fxFetch(`${API_BASE}/archive?${q}`, accessToken, {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      if (!a.ok) continue;
      const js: any = await a.json();
      const entries: any[] = js?.Files ?? js?.Items ?? js?.files ?? [];
      const match = entries.find((e) => {
        const name = (e.Name || e.name || "").toLowerCase();
        const mime = (e.MimeType || e.mimeType || "").toLowerCase();
        return name.includes(String(documentNumber).toLowerCase()) &&
          (mime.includes("pdf") || name.endsWith(".pdf"));
      });
      const fid = match?.FileId ?? match?.Id ?? match?.fileId ?? match?.id;
      const name = match?.Name ?? match?.name ?? `Order-${documentNumber}.pdf`;
      if (!fid) continue;

      const f = await fxFetch(
        `${API_BASE}/archive/filecontents?fileid=${encodeURIComponent(fid)}`,
        accessToken,
        { method: "GET", headers: { Accept: "application/pdf" } }
      );
      if (!f.ok) throw new Error(await f.text());
      const pdf = Buffer.from(await f.arrayBuffer());
      return await savePdfAndUpsertFile(documentNumber, pdf, name);
    } catch {
      /* try next */
    }
  }

  throw new Error(
    `Kunde inte hitta någon orderbekräftelse för order ${documentNumber}. ` +
    `Ingen legacy print, inga v2-attachments/documents och ingen träff i arkivet.`
  );
}

/* =======================================================
   Lista prislistor (PriceLists)
   ======================================================= */
export async function listFortnoxPriceLists({
  page = 1,
  limit = 100,
  tenantId,
}: {
  page?: number;
  limit?: number;
  tenantId?: string;
}): Promise<{ items: FortnoxListItem[] }> {
  const { accessToken } = await getFortnoxAccessToken(tenantId);

  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("limit", String(limit));

  const { text, ok, status } = await fortnoxFetch(
    `${API_BASE}/pricelists?${params}`,
    accessToken
  );
  if (!ok) throw new Error(`Fortnox pricelists failed (${status}): ${text}`);

  const json: any = safeJSON(text);

  // Fortnox varierar: { PriceLists: [...] } eller wrapper
  const arr =
    json?.PriceLists?.PriceList ??
    json?.PriceLists ??
    json?.priceLists ??
    json?.Items ??
    [];

  const items: FortnoxListItem[] = arr
    .map((p: any) => ({
      code: p.Code ?? p.PriceListCode ?? p.code ?? p.id ?? "",
      description: p.Description ?? p.Name ?? p.description ?? "",
    }))
    .filter((x: FortnoxListItem) => x.code);

  return { items };
}
