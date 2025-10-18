"use client";

import Link from "next/link";
import { Fragment, useEffect, useMemo, useState, type JSX } from "react";
import { Card } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { Section } from "@/components/ui/Section";
import { MuseoModerno } from "next/font/google";

const museoModerno = MuseoModerno({
  subsets: ["latin"],
  weight: ["400", "700"],
});

type Track = "A" | "B";
type TrackStatus = "INKOMMANDE" | "PAGAENDE" | "LEVERANS" | "AVSLUTAD";
type FileTrack = Track | "SHARED";

type OrderTrack = {
  track: Track;
  status: TrackStatus | null;
};

type OrderRow = {
  orderNumber: string;
  title: string;
  customerName: string | null;
  createdAt: string | null;
  dueDate: string | null;
  tracks: OrderTrack[];
};

type UiFile = {
  id: string;
  filename: string;
  url: string;
  track: FileTrack;
  createdAt: string | null;
};

const TRACK_LABELS: Record<FileTrack, string> = {
  A: "Ateljé",
  B: "Verkstad",
  SHARED: "Delad",
};

const STATUS_STYLES: Record<TrackStatus, string> = {
  INKOMMANDE: "bg-amber-100 text-amber-900 border-amber-300",
  PAGAENDE: "bg-sky-100 text-sky-900 border-sky-300",
  LEVERANS: "bg-purple-100 text-purple-900 border-purple-300",
  AVSLUTAD: "bg-emerald-100 text-emerald-900 border-emerald-300",
};

const STATUS_TITLES: Record<TrackStatus, string> = {
  INKOMMANDE: "Inkommande",
  PAGAENDE: "Pågående",
  LEVERANS: "Leverans",
  AVSLUTAD: "Avslutad",
};

// --- Type guards to keep TS happy ---
function isTrack(x: unknown): x is Track {
  return x === "A" || x === "B";
}
function isTrackStatus(x: unknown): x is TrackStatus {
  return x === "INKOMMANDE" || x === "PAGAENDE" || x === "LEVERANS" || x === "AVSLUTAD";
}
function isFileTrack(x: unknown): x is FileTrack {
  return x === "A" || x === "B" || x === "SHARED";
}

function toStringOrNull(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  return str === "" ? null : str;
}

function toIso(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object" && value !== null && "toISOString" in value) {
    try {
      return (value as { toISOString: () => string }).toISOString();
    } catch {
      return null;
    }
  }
  return null;
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("sv-SE");
}

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("sv-SE");
}

function toFileTrack(value: unknown): FileTrack {
  return isFileTrack(value) ? value : "SHARED";
}

function renderTrackBadge(track: Track, status: TrackStatus | null): JSX.Element {
  const base =
    "rounded-full border px-2 py-1 text-xs font-semibold inline-flex items-center justify-center gap-1";
  if (!status) {
    return (
      <Badge key={track} className={`${base} bg-slate-100 text-slate-600 border-slate-300`}>
        {TRACK_LABELS[track]}: —
      </Badge>
    );
  }
  return (
    <Badge key={track} className={`${base} ${STATUS_STYLES[status]}`}>
      {TRACK_LABELS[track]}: {STATUS_TITLES[status]}
    </Badge>
  );
}

export default function OrdersOverviewPage() {
  const [query, setQuery] = useState("");
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [openRows, setOpenRows] = useState<Record<string, boolean>>({});
  const [filesByOrder, setFilesByOrder] = useState<Record<string, UiFile[]>>({});
  const [loadingFiles, setLoadingFiles] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setErr(null);
      try {
        const res = await fetch("/api/orders", { cache: "no-store" });
        if (!res.ok) throw new Error(await res.text());

        const json = await res.json();
        const rawSource = [json?.orders, json?.Orders, json?.items, json].find((value) =>
          Array.isArray(value)
        ) as any[] | undefined;
        const raw = rawSource ?? [];

        const mapped = raw
          .filter((item: any) => !item?.billingConfirmedAt)
          .map((item: any): OrderRow | null => {
            const orderNumber = toStringOrNull(
              item?.orderNumber ?? item?.fortnox?.DocumentNumber ?? item?.DocumentNumber
            );
            if (!orderNumber) return null;

            const title =
              toStringOrNull(item?.title) ??
              toStringOrNull(item?.fortnox?.Title) ??
              `Order ${orderNumber}`;

            const customerName =
              toStringOrNull(item?.customerName) ??
              toStringOrNull(item?.fortnox?.CustomerName) ??
              null;

            const trackStatuses: Partial<Record<Track, TrackStatus | null>> = {};

            // Safely iterate and narrow before indexing
            for (const t of (item?.tracks ?? []) as Array<{
              track?: unknown;
              status?: unknown;
            }>) {
              if (isTrack(t?.track)) {
                trackStatuses[t.track] = isTrackStatus(t?.status) ? t.status : null;
              }
            }

            return {
              orderNumber,
              title,
              customerName,
              createdAt: toIso(item?.createdAt),
              dueDate: toIso(item?.dueDate) ?? toIso(item?.fortnox?.DeliveryDate),
              tracks: (["A", "B"] as Track[]).map((track) => ({
                track,
                status: trackStatuses[track] ?? null,
              })),
            };
          })
          .filter(Boolean) as OrderRow[];

        if (!cancelled) setOrders(mapped);
      } catch (e) {
        if (!cancelled) setErr("Kunde inte hämta ordrar.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const data = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter((order) => {
      const haystack = [order.orderNumber, order.title, order.customerName ?? ""];
      return haystack.some((value) => value.toLowerCase().includes(q));
    });
  }, [orders, query]);

  async function toggleFiles(orderNumber: string) {
    setOpenRows((prev) => ({ ...prev, [orderNumber]: !prev[orderNumber] }));
    if (!filesByOrder[orderNumber]) {
      setLoadingFiles((prev) => ({ ...prev, [orderNumber]: true }));
      try {
        const res = await fetch(`/api/orders/${encodeURIComponent(orderNumber)}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(await res.text());
        const json = await res.json();
        const files = (json?.order?.files ?? [])
          .map((f: any) => {
            const id = toStringOrNull(f?.id);
            const filename = toStringOrNull(f?.filename);
            const url = toStringOrNull(f?.url);
            if (!id || !filename || !url) return null;
            return {
              id,
              filename,
              url,
              track: toFileTrack(f?.track),
              createdAt: toIso(f?.createdAt),
            } as UiFile;
          })
          .filter(Boolean) as UiFile[];
        setFilesByOrder((prev) => ({ ...prev, [orderNumber]: files }));
      } catch (error) {
        console.error(error);
        setFilesByOrder((prev) => ({ ...prev, [orderNumber]: [] }));
      } finally {
        setLoadingFiles((prev) => ({ ...prev, [orderNumber]: false }));
      }
    }
  }

  async function deleteFile(orderNumber: string, fileId: string, filename: string) {
    if (!confirm(`Ta bort filen "${filename}"?`)) return;
    const res = await fetch(
      `/api/orders/${encodeURIComponent(orderNumber)}/files/${encodeURIComponent(fileId)}`,
      { method: "DELETE" }
    );
    if (!res.ok) {
      alert("Kunde inte ta bort filen.");
      return;
    }
    setFilesByOrder((prev) => ({
      ...prev,
      [orderNumber]: (prev[orderNumber] ?? []).filter((file) => file.id !== fileId),
    }));
  }

  return (
    <div className="min-h-screen bg-[#f7f3ee]">
      {/* Provide the required title prop to Section */}
      <Section title="Aktiva ordrar" className="max-w-5xl mx-auto py-10 space-y-6">
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <p
              className={`${museoModerno.className} text-[13px] uppercase tracking-[0.3em] text-slate-500`}
            >
              Orderöversikt
            </p>
            <h1 className="text-3xl font-semibold text-slate-900 mt-1">Aktiva ordrar</h1>
          </div>
          <div>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Sök ordernummer eller kund"
              className="h-9 w-[260px] rounded-lg border border-slate-300 bg-white px-3 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-300"
            />
          </div>
        </div>

        <Card className="rounded-xl border border-slate-300 bg-[#f3f1ec] p-3">
          <div className="overflow-auto rounded-lg border border-slate-300 bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left">
                  <th className="px-3 py-2 border-b border-slate-200">Order</th>
                  <th className="px-3 py-2 border-b border-slate-200">Kund</th>
                  <th className="px-3 py-2 border-b border-slate-200">Status</th>
                  <th className="px-3 py-2 border-b border-slate-200">Skapad</th>
                  <th className="px-3 py-2 border-b border-slate-200 text-right">Åtgärder</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={5} className="px-3 py-10 text-center text-slate-500">
                      Hämtar ordrar…
                    </td>
                  </tr>
                )}

                {!loading && err && (
                  <tr>
                    <td colSpan={5} className="px-3 py-10 text-center text-rose-600">
                      {err}
                    </td>
                  </tr>
                )}

                {!loading && !err && data.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-10 text-center text-slate-500">
                      Inga ordrar matchade din sökning.
                    </td>
                  </tr>
                )}

                {!loading &&
                  !err &&
                  data.map((order) => {
                    const open = !!openRows[order.orderNumber];
                    const files = filesByOrder[order.orderNumber] ?? [];
                    return (
                      <Fragment key={order.orderNumber}>
                        <tr className="odd:bg-white even:bg-slate-50/40 align-top">
                          <td className="px-3 py-3 border-t">
                            <div className="font-semibold">#{order.orderNumber}</div>
                            <div className="text-xs text-slate-500 truncate max-w-[220px]">
                              {order.title}
                            </div>
                          </td>
                          <td className="px-3 py-3 border-t">
                            {order.customerName ?? "—"}
                          </td>
                          <td className="px-3 py-3 border-t">
                            <div className="flex flex-wrap gap-2">
                              {order.tracks.map((track) =>
                                renderTrackBadge(track.track, track.status)
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-3 border-t">
                            <div>{formatDate(order.createdAt)}</div>
                            {order.dueDate && (
                              <div className="text-xs text-slate-500">
                                Leverans: {formatDate(order.dueDate)}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-3 border-t text-right">
                            <div className="flex gap-2 justify-end">
                              <Link
                                href={`/orders/${encodeURIComponent(order.orderNumber)}`}
                                className="rounded border px-3 py-1 text-xs hover:bg-slate-100"
                              >
                                Öppna
                              </Link>
                              <button
                                type="button"
                                onClick={() => void toggleFiles(order.orderNumber)}
                                className="rounded border px-3 py-1 text-xs hover:bg-slate-100"
                              >
                                {open ? "Dölj filer" : "Visa filer"}
                              </button>
                            </div>
                          </td>
                        </tr>
                        {open && (
                          <tr>
                            <td colSpan={5} className="px-3 py-3 bg-white border-t">
                              {loadingFiles[order.orderNumber] ? (
                                <div className="text-slate-500">Hämtar filer…</div>
                              ) : files.length === 0 ? (
                                <div className="text-slate-500">Inga filer.</div>
                              ) : (
                                <div className="grid md:grid-cols-2 gap-3">
                                  {files.map((file) => (
                                    <div key={file.id} className="border rounded p-3">
                                      <div className="text-xs text-slate-500 mb-1">
                                        Spår: {TRACK_LABELS[file.track]}
                                      </div>
                                      <a
                                        href={file.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="block font-medium break-all underline"
                                      >
                                        {file.filename}
                                      </a>
                                      <div className="text-xs text-slate-500">
                                        {formatDateTime(file.createdAt)}
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          void deleteFile(
                                            order.orderNumber,
                                            file.id,
                                            file.filename
                                          )
                                        }
                                        className="mt-2 text-xs rounded border px-2 py-1 bg-rose-50 border-rose-300 text-rose-800 hover:bg-rose-100"
                                      >
                                        Ta bort
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </Card>
      </Section>
    </div>
  );
}
