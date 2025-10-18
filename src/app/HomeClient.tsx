// src/app/HomeClient.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { APP_TRACKS, TRACK_NAMES, type AppTrack } from "@/lib/tracks";
import { STATUS_COLOR_PARTS } from "@/lib/orderStatus";
import { OrdinaLogoSpinner } from "@/components/OrdinaLoader";

type Role = "ADMIN" | "SALJARE" | "A_TEAM" | "B_TEAM" | "C_TEAM" | "D_TEAM";
type Status = "INKOMMANDE" | "PAGAENDE" | "LEVERANS" | "AVSLUTAD";

type SummaryMap = Partial<Record<Status, number>>;
type RecentOrder = {
  orderNumber: string;
  title: string;
  customerName?: string | null;
  createdAt?: string | null;
};

type SummaryResponse = { summary: SummaryMap; individuals: SummaryMap };
type RecentResponse = { orders: RecentOrder[] };
type QuickLinkKey = "new" | "overview" | "completed";

const TRACK_DISPLAY: Record<AppTrack, string> = {
  A: TRACK_NAMES.A,
  B: TRACK_NAMES.B,
  C: TRACK_NAMES.C,
  D: TRACK_NAMES.D,
};

const statusChipClasses = (status: Status) => {
  const parts = STATUS_COLOR_PARTS[status];
  return `${parts.bgClass} ${parts.textClass} ${parts.borderClass}`;
};

const ROLE_GREETINGS: Record<Role, string> = {
  ADMIN: "Administratörsvy.",
  SALJARE: "Säljarvy.",
  A_TEAM: "Verkstadsvy.",
  B_TEAM: "Monteringsvy.",
  C_TEAM: "Spår C-vy.",
  D_TEAM: "Spår D-vy.",
};

const PERMS: Record<
  Role,
  {
    quickLinks: QuickLinkKey[];
    trackLinks: AppTrack[];
    trackCards: AppTrack[];
    kpis: Status[];
    showRecent: boolean;
  }
> = {
  ADMIN: {
    quickLinks: ["new", "overview", "completed"],
    trackLinks: [...APP_TRACKS], // make a mutable copy
    trackCards: [...APP_TRACKS],
    kpis: ["INKOMMANDE", "PAGAENDE", "LEVERANS", "AVSLUTAD"],
    showRecent: true,
  },
  SALJARE: {
    quickLinks: ["new", "overview", "completed"],
    trackLinks: [...APP_TRACKS],
    trackCards: [...APP_TRACKS],
    kpis: ["INKOMMANDE", "PAGAENDE", "LEVERANS", "AVSLUTAD"],
    showRecent: true,
  },
  A_TEAM: {
    quickLinks: ["overview"],
    trackLinks: ["A"],
    trackCards: ["A"],
    kpis: ["INKOMMANDE", "PAGAENDE"],
    showRecent: false,
  },
  B_TEAM: {
    quickLinks: ["overview"],
    trackLinks: ["B"],
    trackCards: ["B"],
    kpis: ["INKOMMANDE", "PAGAENDE", "LEVERANS", "AVSLUTAD"],
    showRecent: false,
  },
  C_TEAM: {
    quickLinks: ["overview"],
    trackLinks: ["C"],
    trackCards: ["C"],
    kpis: ["INKOMMANDE", "PAGAENDE", "LEVERANS", "AVSLUTAD"],
    showRecent: false,
  },
  D_TEAM: {
    quickLinks: ["overview"],
    trackLinks: ["D"],
    trackCards: ["D"],
    kpis: ["LEVERANS", "AVSLUTAD"],
    showRecent: false,
  },
};

function trackSummaryCopy(track: AppTrack) {
  return `Status och filer för spår ${track}`;
}

type ChipDef = { key: Status; title: string; color: string };

export default function HomeClient({ name, role }: { name: string; role: Role }) {
  const [summary, setSummary] = useState<SummaryMap>({});
  const [individuals, setIndividuals] = useState<SummaryMap>({});
  const [recent, setRecent] = useState<RecentOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [toInvoice, setToInvoice] = useState<number | null>(null);

  const perms = PERMS[role];
  const quickLinkSet = useMemo(() => new Set(perms.quickLinks), [perms.quickLinks]);

  useEffect(() => {
    (async () => {
      try {
        const summaryUrl = "/api/orders/summary";
        const s: SummaryResponse = await fetch(summaryUrl, { cache: "no-store" }).then(async (r) =>
          r.ok ? ((await r.json()) as SummaryResponse) : { summary: {}, individuals: {} as SummaryMap }
        );

        const r: RecentResponse = await fetch("/api/orders/recent?limit=5", {
          cache: "no-store",
        }).then(async (res) => (res.ok ? ((await res.json()) as RecentResponse) : { orders: [] }));

        setSummary(s?.summary ?? {});
        setIndividuals(s?.individuals ?? {});
        setRecent(r?.orders ?? []);
      } finally {
        setLoading(false);
      }
    })();
  }, [role]);

  useEffect(() => {
    if (!quickLinkSet.has("completed")) {
      setToInvoice(null);
      return;
    }
    (async () => {
      try {
        const r = await fetch("/api/orders/completed", { cache: "no-store" });
        if (r.ok) {
          const data = await r.json();
          setToInvoice(Array.isArray(data?.orders) ? data.orders.length : 0);
        } else {
          setToInvoice(0);
        }
      } catch {
        setToInvoice(0);
      }
    })();
  }, [quickLinkSet]);

  const chips: ChipDef[] = useMemo(
    () => [
      { key: "INKOMMANDE", title: "Inkommande", color: statusChipClasses("INKOMMANDE") },
      { key: "PAGAENDE", title: "Pågående", color: statusChipClasses("PAGAENDE") },
      { key: "LEVERANS", title: "Leverans", color: statusChipClasses("LEVERANS") },
      { key: "AVSLUTAD", title: "Avslutade", color: statusChipClasses("AVSLUTAD") },
    ],
    []
  );

  const visibleChips = chips.filter((c) => perms.kpis.includes(c.key));

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Hej {name.split(" ")[0]}!</h1>
        <p className="text-neutral-600 text-sm">{ROLE_GREETINGS[role]}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 auto-rows-fr">
        {quickLinkSet.has("new") && (
          <Link
            href="/orders/new"
            className="rounded-xl border border-neutral-200 bg-white p-4 hover:shadow-soft"
          >
            <div className="font-semibold">Skapa order</div>
            <div className="text-sm text-neutral-600">Starta en ny order</div>
          </Link>
        )}

        {quickLinkSet.has("completed") && (
          <Link
            href="/orders/completed"
            className="rounded-xl border border-neutral-200 bg-white p-4 hover:shadow-soft"
          >
            <div className="font-semibold">
              Avslutade{" "}
              <span className="ml-1 inline-flex items-center gap-2 text-brand-600">
                {toInvoice === null ? (
                  <>
                    <OrdinaLogoSpinner size={20} />
                    <span className="sr-only">Laddar antal ordrar att fakturera</span>
                  </>
                ) : (
                  `${toInvoice} ${toInvoice === 1 ? "order" : "ordrar"} att fakturera`
                )}
              </span>
            </div>
            <div className="text-sm text-neutral-600">Bekräfta fakturering</div>
          </Link>
        )}

        {quickLinkSet.has("overview") && (
          <Link
            href="/orders/overview"
            className="rounded-xl border border-neutral-200 bg-white p-4 hover:shadow-soft"
          >
            <div className="font-semibold">Översikt</div>
            <div className="text-sm text-neutral-600">Lista alla ordrar</div>
          </Link>
        )}

        {perms.trackLinks.map((track) => (
          <Link
            key={track}
            href={`/orders/track/${track}`}
            className="rounded-xl border border-neutral-200 bg-white p-4 hover:shadow-soft"
          >
            <div className="text-sm text-neutral-500">Spår {track}</div>
            <div className="text-lg font-semibold">{TRACK_DISPLAY[track]}</div>
            <div className="text-xs text-neutral-500 mt-1">{trackSummaryCopy(track)}</div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-8 gap-3 auto-rows-fr">
        {visibleChips.map((c) => {
          const total = loading ? undefined : (summary[c.key] ?? 0);
          const indiv = loading ? undefined : (individuals[c.key] ?? 0);
          const label = indiv === undefined ? null : indiv === 0 ? "Inga hela" : `${indiv} ${indiv === 1 ? "hel" : "hela"}`;

          return (
            <div key={c.key} className={`rounded-lg p-4 ${c.color} h-full flex flex-col gap-1`}>
              <div className="text-xs">{c.title}</div>
              <div className="text-lg font-semibold">{total === undefined ? "…" : total}</div>
              {quickLinkSet.has("new") && label && (
                <div className="text-[11px] text-neutral-700">{label}</div>
              )}
            </div>
          );
        })}
      </div>

      {perms.trackCards.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {perms.trackCards.map((track) => (
            <Link
              key={track}
              href={`/orders/track/${track}`}
              className="rounded-xl border border-neutral-200 bg-white p-4 hover:shadow-soft hover:border-brand-200 transition"
            >
              <div className="text-sm text-neutral-500">Spår {track}</div>
              <div className="text-lg font-semibold">{TRACK_DISPLAY[track]}</div>
              <div className="text-xs text-neutral-500 mt-1">{trackSummaryCopy(track)}</div>
            </Link>
          ))}
        </div>
      )}

      {perms.showRecent && (
        <div className="rounded-xl border border-neutral-200 bg-white">
          <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200">
            <div className="font-semibold">Senaste ordrar</div>
            <Link
              href="/orders/overview"
              className="text-sm underline decoration-transparent hover:decoration-brand-500"
            >
              Visa alla
            </Link>
          </div>
          <div className="divide-y divide-neutral-200">
            {loading && (
              <div className="flex items-center gap-3 px-4 py-3 text-neutral-500">
                <OrdinaLogoSpinner size={28} />
                <span>Laddar senaste ordrar</span>
              </div>
            )}
            {!loading && recent.length === 0 && (
              <div className="px-4 py-3 text-neutral-500">Inga ordrar ännu.</div>
            )}
            {recent.map((o) => (
              <Link key={o.orderNumber} href={`/orders/${o.orderNumber}`} className="block px-4 py-3 hover:bg-neutral-50">
                <div className="flex items-center justify-between">
                  <div className="font-medium truncate">#{o.orderNumber} - {o.title}</div>
                  <div className="text-xs text-neutral-500">{o.customerName ?? "-"}</div>
                </div>
                <div className="text-xs text-neutral-500 mt-0.5">
                  Skapad {o.createdAt ? new Date(o.createdAt).toLocaleString("sv-SE") : "-"}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}



