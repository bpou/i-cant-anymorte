// src/lib/fortnox.ts
import { prisma } from "@/lib/db";

/**
 * Fortnox REST base och OAuth-token endpoint.
 * Håll koll på att du använder /3 (nuvarande stabila base).
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
