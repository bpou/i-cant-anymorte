"use client";

import Link from "next/link";
import { Fragment, useEffect, useMemo, useState, type JSX } from "react";
import { Card } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
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
  A: "Atelj?",
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
  PAGAENDE: "P?g?ende",
  LEVERANS: "Leverans",
  AVSLUTAD: "Avslutad",
};

const STATUS_FILTERS = [
  { key: "ALL", label: "Alla statusar" },
  { key: "INKOMMANDE", label: "Inkommande" },
  { key: "PAGAENDE", label: "P?g?ende" },
  { key: "LEVERANS", label: "Leverans" },
  { key: "AVSLUTAD", label: "Avslutade" },
] as const;

type StatusFilterKey = typeof STATUS_FILTERS[number]["key"];

const TRACK_ORDER: Track[] = ["A", "B"];

const DUE_SOON_DAYS = 7;

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

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDate(value: string | null): string {
  const d = parseDate(value);
  return d ? d.toLocaleDateString("sv-SE") : "?";
}

function formatDateTime(value: string | null): string {
  const d = parseDate(value);
  return d ? d.toLocaleString("sv-SE") : "?";
}

function toFileTrack(value: unknown): FileTrack {
  return value === "A" || value === "B" || value === "SHARED" ? value : "SHARED";
}

function renderTrackBadge(track: Track, status: TrackStatus | null): JSX.Element {
  const base =
    "rounded-full border px-2 py-1 text-xs font-semibold inline-flex items-center justify-center gap-1";
  if (!status) {
    return (
      <Badge key={track} className={`${base} bg-slate-100 text-slate-600 border-slate-300`}>
        {TRACK_LABELS[track]}: ?
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

  const [statusFilter, setStatusFilter] = useState<StatusFilterKey>("ALL");
  const [trackVisibility, setTrackVisibility] = useState<Record<Track, boolean>>({ A: true, B: true });
  const [urgentOnly, setUrgentOnly] = useState(false);
  const [sortMode, setSortMode] = useState<"newest" | "oldest" | "due">("newest");

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
            for (const t of item?.tracks ?? []) {
              if (t?.track === "A" || t?.track === "B") {
                trackStatuses[t.track] = (t?.status as TrackStatus | undefined) ?? null;
              }
            }

            return {
              orderNumber,
              title,
              customerName,
              createdAt: toIso(item?.createdAt),
              dueDate: toIso(item?.dueDate) ?? toIso(item?.fortnox?.DeliveryDate),
              tracks: TRACK_ORDER.map((track) => ({
                track,
                status: trackStatuses[track] ?? null,
              })),
            };
          })
          .filter(Boolean) as OrderRow[];

        if (!cancelled) setOrders(mapped);
      } catch (e) {
        console.error(e);
        if (!cancelled) setErr("Kunde inte h?mta ordrar.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const soonThreshold = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + DUE_SOON_DAYS);
    return d.getTime();
  }, []);

  const statusCount = useMemo(() => {
    const base: Record<TrackStatus, number> = {
      INKOMMANDE: 0,
      PAGAENDE: 0,
      LEVERANS: 0,
      AVSLUTAD: 0,
    };
    for (const order of orders) {
      for (const track of order.tracks) {
        if (track.status) base[track.status] += 1;
      }
    }
    return base;
  }, [orders]);

  const dueSoonCount = useMemo(() => {
    return orders.reduce((acc, order) => {
      const due = parseDate(order.dueDate);
      if (due && due.getTime() <= soonThreshold) return acc + 1;
      return acc;
    }, 0);
  }, [orders, soonThreshold]);

  const filteredOrders = useMemo(() => {
    const q = query.trim().toLowerCase();
    const visibleTracks = Object.entries(trackVisibility)
      .filter(([, enabled]) => enabled)
      .map(([track]) => track as Track);

    const filtered = orders.filter((order) => {
      if (
        q &&
        ![
          order.orderNumber,
          order.title,
          order.customerName ?? "",
        ].some((value) => value.toLowerCase().includes(q))
      ) {
        return false;
      }

      if (statusFilter !== "ALL") {
        const match = order.tracks.some((t) => t.status === statusFilter);
        if (!match) return false;
      }

      if (visibleTracks.length > 0) {
        const match = order.tracks.some((t) => visibleTracks.includes(t.track));
        if (!match) return false;
      }

      if (urgentOnly) {
        const due = parseDate(order.dueDate);
        if (!due || due.getTime() > soonThreshold) return false;
      }

      return true;
    });

    return filtered.sort((a, b) => {
      const createdA = parseDate(a.createdAt)?.getTime() ?? 0;
      const createdB = parseDate(b.createdAt)?.getTime() ?? 0;
      const dueA = parseDate(a.dueDate)?.getTime() ?? Infinity;
      const dueB = parseDate(b.dueDate)?.getTime() ?? Infinity;

      if (sortMode === "newest") return createdB - createdA;
      if (sortMode === "oldest") return createdA - createdB;
      return dueA - dueB;
    });
  }, [orders, query, statusFilter, trackVisibility, urgentOnly, soonThreshold, sortMode]);

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

  function toggleTrack(track: Track) {
    setTrackVisibility((prev) => ({ ...prev, [track]: !prev[track] }));
  }

  function resetFilters() {
    setStatusFilter("ALL");
    setTrackVisibility({ A: true, B: true });
    setUrgentOnly(false);
    setSortMode("newest");
  }

  return (
    <div className="min-h-screen bg-[#f7f3ee]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-0 py-10 space-y-6">
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <p
              className={`${museoModerno.className} text-[13px] uppercase tracking-[0.3em] text-slate-500`}
            >
              Order?versikt
            </p>
            <h1 className="text-3xl font-semibold text-slate-900 mt-1">Aktiva ordrar</h1>
          </div>
          <div className="flex gap-3 items-center">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              Totalt {orders.length}
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
              Leverans inom {DUE_SOON_DAYS} dagar: {dueSoonCount}
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="S?k ordernummer, titel eller kund"
              className="h-9 w-full max-w-[320px] rounded-lg border border-slate-300 bg-white px-3 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-300"
            />
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as typeof sortMode)}
              className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
            >
              <option value="newest">Nyast f?rst</option>
              <option value="oldest">?ldst f?rst</option>
              <option value="due">Leveransdatum</option>
            </select>
            <button
              type="button"
              onClick={() => setUrgentOnly((prev) => !prev)}
              className={`h-9 rounded-lg border px-3 text-sm transition ${
                urgentOnly
                  ? "border-amber-400 bg-amber-50 text-amber-800"
                  : "border-slate-300 bg-white text-slate-600 hover:bg-slate-100"
              }`}
            >
              {urgentOnly ? "Visar leveranser snart" : "Visa leveranser snart"}
            </button>
          </div>
          <button
            type="button"
            onClick={resetFilters}
            className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-600 hover:bg-slate-100"
          >
            ?terst?ll filter
          </button>
        </div>

        <Card className="rounded-xl border border-slate-300 bg-[#f3f1ec] p-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            {STATUS_FILTERS.map((filter) => {
              const isActive = statusFilter === filter.key;
              const count = filter.key === "ALL"
                ? Object.values(statusCount).reduce((sum, value) => sum + value, 0)
                : statusCount[filter.key as TrackStatus] ?? 0;
              return (
                <button
                  key={filter.key}
                  type="button"
                  onClick={() => setStatusFilter(filter.key)}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                    isActive
                      ? "border-emerald-600 bg-emerald-100 text-emerald-800"
                      : "border-slate-300 bg-white text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {filter.label}
                  <span className="ml-1 text-[10px] opacity-70">{count}</span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-2">
            {TRACK_ORDER.map((track) => {
              const active = trackVisibility[track];
              return (
                <button
                  key={track}
                  type="button"
                  onClick={() => toggleTrack(track)}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                    active
                      ? "border-sky-500 bg-sky-100 text-sky-800"
                      : "border-slate-300 bg-white text-slate-500 hover:bg-slate-100"
                  }`}
                >
                  {TRACK_LABELS[track]}
                </button>
              );
            })}
          </div>
        </Card>

        <Card className="rounded-xl border border-slate-300 bg-[#f3f1ec] p-3">
          <div className="overflow-auto rounded-lg border border-slate-300 bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left">
                  <th className="px-3 py-2 border-b border-slate-200">Order</th>
                  <th className="px-3 py-2 border-b border-slate-200">Kund</th>
                  <th className="px-3 py-2 border-b border-slate-200">Status</th>
                  <th className="px-3 py-2 border-b border-slate-200">Skapad</th>
                  <th className="px-3 py-2 border-b border-slate-200">Leverans</th>
                  <th className="px-3 py-2 border-b border-slate-200 text-right">?tg?rder</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={6} className="px-3 py-10 text-center text-slate-500">
                      H?mtar ordrar?
                    </td>
                  </tr>
                )}

                {!loading && err && (
                  <tr>
                    <td colSpan={6} className="px-3 py-10 text-center text-rose-600">
                      {err}
                    </td>
                  </tr>
                )}

                {!loading && !err && filteredOrders.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-10 text-center text-slate-500">
                      Inga ordrar matchade dina filter.
                    </td>
                  </tr>
                )}

                {!loading && !err && filteredOrders.map((order) => {
                  const open = !!openRows[order.orderNumber];
                  const files = filesByOrder[order.orderNumber] ?? [];
                  const dueDate = parseDate(order.dueDate);
                  const dueSoon = dueDate ? dueDate.getTime() <= soonThreshold : false;
                  const createdDate = parseDate(order.createdAt);
                  return (
                    <Fragment key={order.orderNumber}>
                      <tr
                        className={`odd:bg-white even:bg-slate-50/40 align-top ${
                          dueSoon ? "ring-1 ring-amber-200" : ""
                        }`}
                      >
                        <td className="px-3 py-3 border-t">
                          <div className="font-semibold">#{order.orderNumber}</div>
                          <div className="text-xs text-slate-500 truncate max-w-[220px]">
                            {order.title}
                          </div>
                        </td>
                        <td className="px-3 py-3 border-t">
                          {order.customerName ?? "?"}
                        </td>
                        <td className="px-3 py-3 border-t">
                          <div className="flex flex-wrap gap-2">
                            {order.tracks.map((track) => renderTrackBadge(track.track, track.status))}
                          </div>
                        </td>
                        <td className="px-3 py-3 border-t">
                          <div>{formatDate(order.createdAt)}</div>
                          {createdDate && (
                            <div className="text-xs text-slate-500">
                              {Math.round((Date.now() - createdDate.getTime()) / 86_400_000)} dagar sedan
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-3 border-t">
                          <div className={dueSoon ? "text-amber-700 font-semibold" : ""}>
                            {formatDate(order.dueDate)}
                          </div>
                          {dueSoon && (
                            <div className="text-xs text-amber-600">Leverans inom {DUE_SOON_DAYS} dagar</div>
                          )}
                        </td>
                        <td className="px-3 py-3 border-t text-right">
                          <div className="flex gap-2 justify-end">
                            <Link
                              href={`/orders/${encodeURIComponent(order.orderNumber)}`}
                              className="rounded border px-3 py-1 text-xs hover:bg-slate-100"
                            >
                              ?ppna
                            </Link>
                            <button
                              type="button"
                              onClick={() => void toggleFiles(order.orderNumber)}
                              className="rounded border px-3 py-1 text-xs hover:bg-slate-100"
                            >
                              {open ? "D?lj filer" : "Visa filer"}
                            </button>
                          </div>
                        </td>
                      </tr>
                      {open && (
                        <tr>
                          <td colSpan={6} className="px-3 py-3 bg-white border-t">
                            {loadingFiles[order.orderNumber] ? (
                              <div className="text-slate-500">H?mtar filer?</div>
                            ) : files.length === 0 ? (
                              <div className="text-slate-500">Inga filer.</div>
                            ) : (
                              <div className="grid md:grid-cols-2 gap-3">
                                {files.map((file) => (
                                  <div key={file.id} className="border rounded p-3">
                                    <div className="text-xs text-slate-500 mb-1">
                                      Sp?r: {TRACK_LABELS[file.track]}
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
                                        void deleteFile(order.orderNumber, file.id, file.filename)
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
      </div>
    </div>
  );
}
