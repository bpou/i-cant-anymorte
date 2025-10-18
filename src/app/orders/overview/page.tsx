"use client";

import Link from "next/link";
import { memo, useDeferredValue, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { MuseoModerno } from "next/font/google";
import { useSession } from "next-auth/react";
import { APP_TRACKS, TRACK_NAMES, isAppTrack, type AppTrack } from "@/lib/tracks";
import { STATUS_COLORS } from "@/lib/orderStatus";

type Role = "ADMIN" | "SALJARE" | "A_TEAM" | "B_TEAM" | "C_TEAM" | "D_TEAM";
type Track = AppTrack;
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
  createdById: string | null;
  createdByName: string | null;
  createdByEmail: string | null;
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

type SummaryMap = Record<TrackStatus, number>;

type OwnerFilter = "all" | "mine";

const museoModerno = MuseoModerno({
  subsets: ["latin"],
  weight: ["400", "700"],
});

const TRACK_LABELS: Record<FileTrack, string> = {
  A: TRACK_NAMES.A,
  B: TRACK_NAMES.B,
  C: TRACK_NAMES.C,
  D: TRACK_NAMES.D,
  SHARED: "Delad",
};

const STATUS_TITLES: Record<TrackStatus, string> = {
  INKOMMANDE: "Inkommande",
  PAGAENDE: "Pågående",
  LEVERANS: "Leverans",
  AVSLUTAD: "Avslutad",
};

const STATUS_DESCRIPTIONS: Record<TrackStatus, string> = {
  INKOMMANDE: "Nyligen inkomna uppdrag redo att planeras",
  PAGAENDE: "Spår där arbetet är igång",
  LEVERANS: "Ordrar på väg till kund",
  AVSLUTAD: "Färdigställda ordrar som väntar på fakturering",
};

const STATUS_STYLES: Record<TrackStatus, string> = {
  INKOMMANDE: STATUS_COLORS.INKOMMANDE,
  PAGAENDE: STATUS_COLORS.PAGAENDE,
  LEVERANS: STATUS_COLORS.LEVERANS,
  AVSLUTAD: STATUS_COLORS.AVSLUTAD,
};

const STATUS_SEQUENCE: TrackStatus[] = ["INKOMMANDE", "PAGAENDE", "LEVERANS", "AVSLUTAD"];

const TRACK_SCOPE: Record<Role, Track[]> = {
  ADMIN: [...APP_TRACKS],
  SALJARE: [...APP_TRACKS],
  A_TEAM: ["A"],
  B_TEAM: ["B"],
  C_TEAM: ["C"],
  D_TEAM: ["D"],
};

const actionButton =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-brand-200 bg-white px-3 py-1.5 text-sm font-medium text-brand-700 transition hover:border-brand-300 hover:bg-brand-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-300";

function isTrack(x: unknown): x is Track {
  return isAppTrack(x);
}

function isTrackStatus(x: unknown): x is TrackStatus {
  return x === "INKOMMANDE" || x === "PAGAENDE" || x === "LEVERANS" || x === "AVSLUTAD";
}

function isFileTrack(x: unknown): x is FileTrack {
  return x === "SHARED" || isAppTrack(x);
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

const dateFmt = new Intl.DateTimeFormat("sv-SE");
const dateTimeFmt = new Intl.DateTimeFormat("sv-SE", {
  dateStyle: "short",
  timeStyle: "short",
});

function formatDate(value: string | null): string {
  if (!value) return "-";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "-" : dateFmt.format(d);
}

function formatDateTime(value: string | null): string {
  if (!value) return "-";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "-" : dateTimeFmt.format(d);
}

function toFileTrack(value: unknown): FileTrack {
  return isFileTrack(value) ? value : "SHARED";
}

function isOwnOrder(order: OrderRow, userId: string | null, userEmail: string | null): boolean {
  if (!userId && !userEmail) return false;
  if (userId && order.createdById && order.createdById === userId) {
    return true;
  }
  if (userEmail) {
    const creatorEmail = order.createdByEmail ? order.createdByEmail.toLowerCase() : null;
    if (creatorEmail && creatorEmail === userEmail.toLowerCase()) {
      return true;
    }
  }
  return false;
}

function TrackBadge({
  track,
  status,
  muted,
}: {
  track: Track;
  status: TrackStatus | null;
  muted?: boolean;
}) {
  const base =
    "rounded-full border px-2 py-1 text-xs font-semibold inline-flex items-center justify-center gap-1 transition";
  const mutedClass = muted ? "opacity-40" : "";

  if (!status) {
    return (
      <Badge className={`${base} bg-neutral-100 text-neutral-600 border-neutral-200 ${mutedClass}`}>
        {TRACK_LABELS[track]}: -
      </Badge>
    );
  }

  return (
    <Badge className={`${base} ${STATUS_STYLES[status]} ${mutedClass}`}>
      {TRACK_LABELS[track]}: {STATUS_TITLES[status]}
    </Badge>
  );
}

const FilesList = memo(function FilesList({
  orderNumber,
  files,
  onDelete,
  loading,
}: {
  orderNumber: string;
  files: UiFile[];
  loading: boolean;
  onDelete: (orderNumber: string, fileId: string, filename: string) => Promise<void>;
}) {
  if (loading) {
    return <div className="text-sm text-neutral-500">Hämtar filer…</div>;
  }

  if (!files.length) {
    return <div className="text-sm text-neutral-500">Inga filer ännu.</div>;
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {files.map((file) => (
        <div
          key={file.id}
          className="rounded-xl border border-brand-200 bg-white/95 p-4 shadow-[0_14px_34px_-28px_rgba(15,23,42,0.45)]"
        >
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-brand-500">
            Spår: {TRACK_LABELS[file.track]}
          </div>
          <a
            href={file.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block break-all text-sm font-semibold text-brand-700 underline-offset-2 hover:underline"
          >
            {file.filename}
          </a>
          <div className="mt-1 text-xs text-neutral-500">{formatDateTime(file.createdAt)}</div>
          <button
            type="button"
            onClick={() => void onDelete(orderNumber, file.id, file.filename)}
            className="mt-3 inline-flex items-center justify-center rounded-md border border-error-200 bg-error-50 px-2 py-1 text-xs font-medium text-error-700 transition hover:bg-error-100"
          >
            Ta bort
          </button>
        </div>
      ))}
    </div>
  );
});

const SummaryTile = memo(function SummaryTile({
  status,
  total,
}: {
  status: TrackStatus;
  total: number;
}) {
  return (
    <Card className="flex h-full flex-col justify-between rounded-2xl border border-brand-200 bg-gradient-to-br from-white via-white to-brand-50/60 p-5 shadow-[0_18px_35px_-28px_rgba(15,23,42,0.42)]">
      <div className="text-[11px] font-semibold uppercase tracking-[0.32em] text-brand-600">
        {STATUS_TITLES[status]}
      </div>
      <div className="mt-3 text-3xl font-semibold text-neutral-900">{total}</div>
      <p className="mt-4 text-xs leading-relaxed text-neutral-600">{STATUS_DESCRIPTIONS[status]}</p>
    </Card>
  );
});

const FilterPill = memo(function FilterPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-300 ${
        active
          ? "border-brand-300 bg-brand-50/80 text-brand-700 shadow-[0_12px_30px_-26px_rgba(15,23,42,0.48)]"
          : "border-brand-100 bg-white text-neutral-600 hover:border-brand-200 hover:bg-brand-50/40"
      }`}
    >
      {label}
    </button>
  );
});

const OrderCard = memo(function OrderCard({
  order,
  open,
  files,
  loadingFiles,
  onToggle,
  onDeleteFile,
  activeTrack,
  activeStatus,
}: {
  order: OrderRow;
  open: boolean;
  files: UiFile[];
  loadingFiles: boolean;
  onToggle: (orderNumber: string) => void;
  onDeleteFile: (orderNumber: string, fileId: string, filename: string) => Promise<void>;
  activeTrack: Track | "ALL";
  activeStatus: TrackStatus | "ALL";
}) {
  const creatorLabel = order.createdByName ?? order.createdByEmail ?? "Okänd";
  const hasCreator = Boolean(order.createdByName ?? order.createdByEmail);

  return (
    <Card className="rounded-3xl border border-brand-200 bg-white/95 p-6 shadow-[0_24px_70px_-48px_rgba(15,23,42,0.52)]">
      <div className="flex flex-col gap-5 md:flex-row md:justify-between">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-baseline gap-2 text-neutral-500">
            <span className="text-[11px] font-semibold uppercase tracking-[0.32em] text-brand-500">Order</span>
            <span className="text-xl font-semibold text-neutral-900">#{order.orderNumber}</span>
          </div>
          <h2 className="text-lg font-semibold text-neutral-900">{order.title}</h2>
          <div className="flex flex-wrap gap-2">
            {order.tracks.map(({ track, status }) => {
              const muted =
                (activeTrack !== "ALL" && track !== activeTrack) ||
                (activeStatus !== "ALL" && status !== activeStatus);
              return <TrackBadge key={track} track={track} status={status} muted={muted} />;
            })}
          </div>
        </div>

        <div className="flex flex-col items-start gap-2 text-sm text-neutral-600 md:items-end">
          <div className="inline-flex items-center justify-center rounded-full border border-brand-200 bg-brand-50/80 px-3 py-1 text-xs font-semibold text-brand-700">
            {order.customerName ?? "Okänd kund"}
          </div>
          <div className="text-xs text-neutral-500">
            Skapad {formatDate(order.createdAt)}
            {order.dueDate ? ` · Leverans ${formatDate(order.dueDate)}` : ""}
          </div>
          <div className={`text-xs ${hasCreator ? "text-neutral-600" : "italic text-neutral-400"}`}>
            Skapad av {creatorLabel}
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/orders/${encodeURIComponent(order.orderNumber)}`} className={actionButton}>
              Öppna order
            </Link>
            <button
              type="button"
              aria-expanded={open}
              aria-controls={`files-${order.orderNumber}`}
              onClick={() => onToggle(order.orderNumber)}
              className={actionButton}
            >
              {open ? "Dölj filer" : "Visa filer"}
            </button>
          </div>
        </div>
      </div>

      {open && (
        <div
          id={`files-${order.orderNumber}`}
          className="mt-5 rounded-xl border border-brand-200 bg-brand-50/60 p-4"
        >
          <FilesList
            orderNumber={order.orderNumber}
            files={files}
            loading={loadingFiles}
            onDelete={onDeleteFile}
          />
        </div>
      )}
    </Card>
  );
});

const LoadingList = memo(function LoadingList() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, idx) => (
        <div
          key={idx}
          className="h-40 animate-pulse rounded-3xl border border-brand-100 bg-brand-50/60"
        />
      ))}
    </div>
  );
});

const EmptyState = memo(function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <Card className="rounded-3xl border border-dashed border-brand-200 bg-brand-50/50 p-8 text-center text-neutral-600 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.45)]">
      <h2 className="text-lg font-semibold text-neutral-900">{title}</h2>
      <p className="mt-2 text-sm text-neutral-600">{description}</p>
    </Card>
  );
});

export default function OrdersOverviewPage() {
  const [query, setQuery] = useState("");
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [openRows, setOpenRows] = useState<Record<string, boolean>>({});
  const [filesByOrder, setFilesByOrder] = useState<Record<string, UiFile[]>>({});
  const [loadingFiles, setLoadingFiles] = useState<Record<string, boolean>>({});
  const [ownerFilter, setOwnerFilter] = useState<OwnerFilter>("all");
  const [trackFilter, setTrackFilter] = useState<Track | "ALL">("ALL");
  const [statusFilter, setStatusFilter] = useState<TrackStatus | "ALL">("ALL");

  const { data: session, status: sessionStatus } = useSession();
  const sessionUser = session?.user as { id?: string | null; email?: string | null; role?: Role | string } | undefined;
  const sessionUserId = typeof sessionUser?.id === "string" ? sessionUser.id : null;
  const sessionUserEmail = typeof sessionUser?.email === "string" ? sessionUser.email.trim().toLowerCase() : null;
  const role = (sessionUser?.role as Role | undefined) ?? undefined;

  const showOwnerFilter = role === "SALJARE";
  const canFilterToMine = showOwnerFilter && sessionStatus === "authenticated" && Boolean(sessionUserId || sessionUserEmail);
  const effectiveOwnerFilter: OwnerFilter = showOwnerFilter && ownerFilter === "mine" && canFilterToMine ? "mine" : "all";
  const mineDisabled = !canFilterToMine;

  const deferredQuery = useDeferredValue(query.trim().toLowerCase());

  const availableTracks = useMemo(() => {
    if (role && TRACK_SCOPE[role]) {
      return TRACK_SCOPE[role];
    }
    return APP_TRACKS;
  }, [role]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setErr(null);
      try {
        const res = await fetch("/api/orders", { cache: "no-store" });
        if (!res.ok) throw new Error(await res.text());

        const json = await res.json();
        const rawSource = [json?.orders, json?.Orders, json?.items, json].find(Array.isArray) as any[] | undefined;
        const raw = rawSource ?? [];

        const mapped = (raw
          .filter((item: any) => !item?.billingConfirmedAt)
          .map((item: any): OrderRow | null => {
            const orderNumber = toStringOrNull(
              item?.orderNumber ?? item?.fortnox?.DocumentNumber ?? item?.DocumentNumber,
            );
            if (!orderNumber) return null;

            const title =
              toStringOrNull(item?.title) ??
              toStringOrNull(item?.fortnox?.Title) ??
              `Order ${orderNumber}`;

            const customerName =
              toStringOrNull(item?.customerName) ?? toStringOrNull(item?.fortnox?.CustomerName) ?? null;
            const createdById = toStringOrNull(item?.createdById ?? item?.createdBy?.id);
            const createdByName =
              toStringOrNull(item?.createdByName) ?? toStringOrNull(item?.createdBy?.name) ?? null;
            const createdByEmail = toStringOrNull(item?.createdByEmail ?? item?.createdBy?.email) ?? null;

            const trackStatuses: Partial<Record<Track, TrackStatus | null>> = {};
            for (const t of (item?.tracks ?? []) as Array<{ track?: unknown; status?: unknown }>) {
              if (isTrack(t?.track)) trackStatuses[t.track] = isTrackStatus(t?.status) ? t.status : null;
            }

            return {
              orderNumber,
              title,
              customerName,
              createdById,
              createdByName,
              createdByEmail,
              createdAt: toIso(item?.createdAt),
              dueDate: toIso(item?.dueDate) ?? toIso(item?.fortnox?.DeliveryDate),
              tracks: APP_TRACKS.map((track) => ({ track, status: trackStatuses[track] ?? null })),
            };
          })
          .filter(Boolean)) as OrderRow[];

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

  const filtered = useMemo(() => {
    return orders.filter((order) => {
      const matchesQuery =
        !deferredQuery ||
        [order.orderNumber, order.title, order.customerName ?? ""].some((v) =>
          v.toLowerCase().includes(deferredQuery),
        );
      if (!matchesQuery) return false;

      if (effectiveOwnerFilter === "mine" && !isOwnOrder(order, sessionUserId, sessionUserEmail)) {
        return false;
      }

      if (trackFilter !== "ALL") {
        const hasTrack = order.tracks.some((t) => t.track === trackFilter);
        if (!hasTrack) return false;
      }

      if (statusFilter !== "ALL") {
        const hasStatus = order.tracks.some((t) => t.status === statusFilter);
        if (!hasStatus) return false;
      }

      return true;
    });
  }, [
    orders,
    deferredQuery,
    effectiveOwnerFilter,
    sessionUserEmail,
    sessionUserId,
    trackFilter,
    statusFilter,
  ]);

  const statusTotals: SummaryMap = useMemo(() => {
    const totals: SummaryMap = {
      INKOMMANDE: 0,
      PAGAENDE: 0,
      LEVERANS: 0,
      AVSLUTAD: 0,
    };
    for (const order of orders) {
      const orderStatuses = new Set<TrackStatus>();
      for (const t of order.tracks) {
        if (t.status) {
          orderStatuses.add(t.status);
        }
      }
      orderStatuses.forEach((s) => {
        totals[s] += 1;
      });
    }
    return totals;
  }, [orders]);

  async function toggleFiles(orderNumber: string) {
    setOpenRows((prev) => ({ ...prev, [orderNumber]: !prev[orderNumber] }));
    if (!filesByOrder[orderNumber]) {
      setLoadingFiles((prev) => ({ ...prev, [orderNumber]: true }));
      try {
        const res = await fetch(`/api/orders/${encodeURIComponent(orderNumber)}`, { cache: "no-store" });
        if (!res.ok) throw new Error(await res.text());
        const json = await res.json();
        const files = (json?.order?.files ?? [])
          .map((f: any) => {
            const id = toStringOrNull(f?.id);
            const filename = toStringOrNull(f?.filename);
            const url = toStringOrNull(f?.url);
            if (!id || !filename || !url) return null;
            return { id, filename, url, track: toFileTrack(f?.track), createdAt: toIso(f?.createdAt) } as UiFile;
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
      { method: "DELETE" },
    );
    if (!res.ok) {
      alert("Kunde inte ta bort filen.");
      return;
    }
    setFilesByOrder((prev) => ({
      ...prev,
      [orderNumber]: (prev[orderNumber] ?? []).filter((f) => f.id !== fileId),
    }));
  }

  function clearFilters() {
    setTrackFilter("ALL");
    setStatusFilter("ALL");
    if (showOwnerFilter) {
      setOwnerFilter("all");
    }
  }

  const activeFilters = useMemo(() => {
    const list: string[] = [];
    if (trackFilter !== "ALL") list.push(`Spår ${TRACK_LABELS[trackFilter]}`);
    if (statusFilter !== "ALL") list.push(STATUS_TITLES[statusFilter]);
    if (effectiveOwnerFilter === "mine") list.push("Mina ordrar");
    if (deferredQuery) list.push("Sökning aktiv");
    return list;
  }, [trackFilter, statusFilter, effectiveOwnerFilter, deferredQuery]);

  const hasResults = filtered.length > 0;

  return (
    <div className="relative min-h-screen overflow-hidden bg-white">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(28,155,241,0.08),_transparent_55%)]" />
      <div className="pointer-events-none absolute -right-24 top-16 -z-10 h-[360px] w-[360px] rounded-[32px] border border-brand-200/70 bg-white/70 shadow-[0_40px_100px_-70px_rgba(15,23,42,0.35)] blur-xl" />

      <div className="mx-auto w-full max-w-6xl space-y-10 px-4 py-12 sm:px-6 lg:px-10">
        <div className="rounded-3xl border border-brand-200 bg-white/95 px-6 py-8 shadow-[0_24px_70px_-48px_rgba(15,23,42,0.5)] sm:px-8">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-4">
              <span className={`${museoModerno.className} inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.38em] text-brand-600`}>
                Ordersammanställning
              </span>
              <div className="space-y-2">
                <h1 className="text-3xl font-semibold text-neutral-900 sm:text-4xl">Aktiva ordrar</h1>
                <p className="text-sm leading-relaxed text-neutral-600">
                  Visar {filtered.length} av {orders.length} ordrar. Justera filtren för att snabbt hitta rätt uppdrag.
                </p>
              </div>

              {activeFilters.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {activeFilters.map((item) => (
                    <span
                      key={item}
                      className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 shadow-[0_12px_32px_-26px_rgba(15,23,42,0.45)]"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-4 lg:w-auto">
              {STATUS_SEQUENCE.map((status) => (
                <SummaryTile key={status} status={status} total={statusTotals[status]} />
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-brand-200 bg-white/95 p-6 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.48)]">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-wrap gap-2">
                <FilterPill
                  label="Alla spår"
                  active={trackFilter === "ALL"}
                  onClick={() => setTrackFilter("ALL")}
                />
                {availableTracks.map((track) => (
                  <FilterPill
                    key={track}
                    label={`Spår ${track}`}
                    active={trackFilter === track}
                    onClick={() => setTrackFilter((prev) => (prev === track ? "ALL" : track))}
                  />
                ))}
              </div>
              <div className="relative">
                <label className="sr-only" htmlFor="order-search">
                  Sök ordernummer eller kund
                </label>
                <input
                  id="order-search"
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Sök ordernummer eller kund"
                  className="h-11 w-full min-w-[240px] rounded-xl border border-brand-200 bg-white px-4 text-sm text-neutral-700 placeholder:text-neutral-400 focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-brand-300"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex flex-wrap gap-2">
                <FilterPill
                  label="Alla statusar"
                  active={statusFilter === "ALL"}
                  onClick={() => setStatusFilter("ALL")}
                />
                {STATUS_SEQUENCE.map((status) => (
                  <FilterPill
                    key={status}
                    label={STATUS_TITLES[status]}
                    active={statusFilter === status}
                    onClick={() => setStatusFilter((prev) => (prev === status ? "ALL" : status))}
                  />
                ))}
              </div>

              {showOwnerFilter && (
                <div
                  role="group"
                  aria-label="Filtrera ägande"
                  className="inline-flex overflow-hidden rounded-full border border-brand-200 bg-white shadow-[0_12px_34px_-26px_rgba(15,23,42,0.45)]"
                >
                  <button
                    type="button"
                    onClick={() => setOwnerFilter("all")}
                    className={`px-3 py-1.5 text-xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-300 ${
                      effectiveOwnerFilter === "all"
                        ? "bg-brand-600 text-white"
                        : "text-neutral-600 hover:bg-brand-50/60"
                    }`}
                  >
                    Alla ordrar
                  </button>
                  <button
                    type="button"
                    onClick={() => setOwnerFilter("mine")}
                    aria-disabled={mineDisabled}
                    disabled={mineDisabled}
                    className={`px-3 py-1.5 text-xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-300 ${
                      effectiveOwnerFilter === "mine"
                        ? "bg-brand-600 text-white"
                        : "text-neutral-600 hover:bg-brand-50/60"
                    } disabled:cursor-not-allowed disabled:opacity-60`}
                  >
                    Mina ordrar
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={clearFilters}
                className="ml-auto inline-flex items-center justify-center rounded-full border border-brand-200 px-3 py-1 text-xs font-semibold text-neutral-600 transition hover:border-brand-300 hover:text-brand-700"
              >
                Nollställ filter
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {loading && <LoadingList />}

          {!loading && err && (
            <EmptyState title="Något gick fel" description={err} />
          )}

          {!loading && !err && !hasResults && (
            <EmptyState
              title="Inga ordrar hittades"
              description="Justera filtren eller sökningen för att hitta det du letar efter."
            />
          )}

          {!loading && !err && hasResults && (
            <div className="space-y-5">
              {filtered.map((order) => (
                <OrderCard
                  key={order.orderNumber}
                  order={order}
                  open={!!openRows[order.orderNumber]}
                  files={filesByOrder[order.orderNumber] ?? []}
                  loadingFiles={!!loadingFiles[order.orderNumber]}
                  onToggle={toggleFiles}
                  onDeleteFile={deleteFile}
                  activeTrack={trackFilter}
                  activeStatus={statusFilter}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
