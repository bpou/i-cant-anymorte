// src/app/HomeClient.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Role = "ADMIN" | "SALJARE" | "A_TEAM" | "B_TEAM";
type Status = "INKOMMANDE" | "PAGAENDE" | "LEVERANS" | "AVSLUTAD";
type Track = "A" | "B";

type SummaryMap = Partial<Record<Status, number>>;
type RecentOrder = {
  orderNumber: string;
  title: string;
  customerName?: string | null;
  createdAt?: string | null;
};

type SummaryResponse = { summary: SummaryMap; individuals: SummaryMap };
type RecentResponse = { orders: RecentOrder[] };

const PERMS: Record<
  Role,
  {
    quickLinks: Array<"new" | "overview" | "trackA" | "trackB">;
    tracks: Track[];
    kpis: Status[];
    showRecent: boolean;
  }
> = {
  ADMIN: {
    quickLinks: ["new", "overview", "trackA", "trackB"],
    tracks: ["A", "B"],
    kpis: ["INKOMMANDE", "PAGAENDE", "LEVERANS", "AVSLUTAD"],
    showRecent: true,
  },
  SALJARE: {
    quickLinks: ["new", "overview", "trackA", "trackB"],
    tracks: ["A", "B"],
    kpis: ["INKOMMANDE", "PAGAENDE", "LEVERANS", "AVSLUTAD"],
    showRecent: true,
  },
  A_TEAM: {
    quickLinks: ["overview", "trackA"],
    tracks: ["A"],
    kpis: ["INKOMMANDE", "PAGAENDE"],
    showRecent: false,
  },
  B_TEAM: {
    quickLinks: ["overview", "trackB"],
    tracks: ["B"],
    kpis: ["LEVERANS", "AVSLUTAD"],
    showRecent: false,
  },
};

const TRACK_LABELS = { A: "Verkstad", B: "Montering" } as const;

export default function HomeClient({ name, role }: { name: string; role: Role }) {
  const [summary, setSummary] = useState<SummaryMap>({});
  const [individuals, setIndividuals] = useState<SummaryMap>({});
  const [recent, setRecent] = useState<RecentOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [toInvoice, setToInvoice] = useState<number | null>(null); // ⬅️ NYTT

  const perms = PERMS[role];

  useEffect(() => {
    (async () => {
      try {
        const summaryUrl = "/api/orders/summary";
        const s: SummaryResponse = await fetch(summaryUrl, { cache: "no-store" })
          .then(async (r) =>
            r.ok
              ? ((await r.json()) as SummaryResponse)
              : { summary: {}, individuals: {} as SummaryMap }
          );

        const r: RecentResponse = await fetch("/api/orders/recent?limit=5", {
          cache: "no-store",
        }).then(async (r) => (r.ok ? ((await r.json()) as RecentResponse) : { orders: [] }));

        setSummary(s?.summary ?? {});
        setIndividuals(s?.individuals ?? {});
        setRecent(r?.orders ?? []);
      } finally {
        setLoading(false);
      }
    })();
  }, [role]);

  // ⬅️ NYTT: hämta hur många som är avslutade men ej fakturerade
  useEffect(() => {
    if (role === "ADMIN" || role === "SALJARE") {
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
    }
  }, [role]);

  const chips = useMemo(
    () =>
      [
        { key: "INKOMMANDE", title: "Inkommande", color: "bg-amber-100 text-amber-900" },
        { key: "PAGAENDE",   title: "Pågående",   color: "bg-sky-100 text-sky-900" },
        { key: "LEVERANS",   title: "Leverans",   color: "bg-purple-100 text-purple-900" },
        { key: "AVSLUTAD",   title: "Avslutade",  color: "bg-emerald-100 text-emerald-900" },
      ] as const,
    []
  );

  const visibleChips = chips.filter((c) => perms.kpis.includes(c.key as Status));
  const showA = perms.tracks.includes("A");
  const showB = perms.tracks.includes("B");

  return (
    <div className="p-6 space-y-6">
      {/* Hälsning */}
      <div>
        <h1 className="text-xl font-semibold">Hej {name.split(" ")[0]}!</h1>
        <p className="text-slate-600 text-sm">
          {role === "ADMIN" ? "Administratörsvy." :
           role === "SALJARE" ? "Säljvy." :
           role === "A_TEAM" ? "Verkstadsvy." :
           "Monteringsvy."}
        </p>
      </div>

      {/* Snabba genvägar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {(role === "ADMIN" || role === "SALJARE") && (
          <Link href="/orders/new" className="rounded-xl border bg-white p-4 hover:shadow">
            <div className="font-semibold">Skapa order</div>
            <div className="text-sm text-slate-600">Starta en ny order</div>
          </Link>
        )}

        {(role === "ADMIN" || role === "SALJARE") && (
          <Link href="/orders/completed" className="rounded-xl border bg-white p-4 hover:shadow">
            <div className="font-semibold">
              Avslutade{" "}
              <span className="ml-1 text-emerald-600">
                {toInvoice === null
                  ? "…"
                  : `${toInvoice} ${toInvoice === 1 ? "order" : "ordrar"} att fakturera`}
              </span>
            </div>
            <div className="text-sm text-slate-600">Bekräfta fakturering</div>
          </Link>
        )}

        {perms.quickLinks.includes("overview") && (
          <Link href="/orders/overview" className="rounded-xl border bg-white p-4 hover:shadow">
            <div className="font-semibold">Översikt</div>
            <div className="text-sm text-slate-600">Lista alla ordrar</div>
          </Link>
        )}

        {perms.quickLinks.includes("trackA") && (
          <Link href="/orders/track/A" className="rounded-xl border bg-white p-4 hover:shadow">
            <div className="font-semibold">{TRACK_LABELS.A}</div>
            <div className="text-sm text-slate-600">Visa spår A</div>
          </Link>
        )}

        {perms.quickLinks.includes("trackB") && (
          <Link href="/orders/track/B" className="rounded-xl border bg-white p-4 hover:shadow">
            <div className="font-semibold">{TRACK_LABELS.B}</div>
            <div className="text-sm text-slate-600">Visa spår B</div>
          </Link>
        )}
      </div>

      {/* KPI-chips */}
      <div className="flex flex-wrap gap-2">
        {visibleChips.map((c) => {
          const total = loading ? undefined : (summary[c.key as Status] ?? 0);
          const indiv = loading ? undefined : (individuals[c.key as Status] ?? 0);
          const label =
            indiv === undefined
              ? null
              : indiv === 0
              ? "Inga hela"
              : `${indiv} ${indiv === 1 ? "hel" : "hela"}`;

          return (
            <div key={c.key} className={`rounded-lg px-3 py-2 border ${c.color}`}>
              <div className="text-xs">{c.title}</div>
              <div className="text-lg font-semibold">
                {total === undefined ? "…" : total}
              </div>
              {(role === "ADMIN" || role === "SALJARE") && label && (
                <div className="text-[11px] text-slate-700">{label}</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Spårkort */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {showA && (
          <Link href="/orders/track/A" className="rounded-xl border bg-white p-4 hover:shadow">
            <div className="text-sm text-slate-500">Spår A</div>
            <div className="text-lg font-semibold">{TRACK_LABELS.A}</div>
            <div className="text-xs text-slate-500 mt-1">Status och filer för spår A</div>
          </Link>
        )}
        {showB && (
          <Link href="/orders/track/B" className="rounded-xl border bg-white p-4 hover:shadow">
            <div className="text-sm text-slate-500">Spår B</div>
            <div className="text-lg font-semibold">{TRACK_LABELS.B}</div>
            <div className="text-xs text-slate-500 mt-1">Status och filer för spår B</div>
          </Link>
        )}
      </div>

      {/* Senaste ordrar */}
      {perms.showRecent && (
        <div className="rounded-xl border bg-white">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <div className="font-semibold">Senaste ordrar</div>
            <Link href="/orders/overview" className="text-sm underline decoration-transparent hover:decoration-inherit">
              Visa alla
            </Link>
          </div>
          <div className="divide-y">
            {loading && <div className="px-4 py-3 text-slate-500">Laddar…</div>}
            {!loading && recent.length === 0 && (
              <div className="px-4 py-3 text-slate-500">Inga ordrar ännu.</div>
            )}
            {recent.map((o) => (
              <Link key={o.orderNumber} href={`/orders/${o.orderNumber}`} className="block px-4 py-3 hover:bg-slate-50">
                <div className="flex items-center justify-between">
                  <div className="font-medium truncate">
                    #{o.orderNumber} – {o.title}
                  </div>
                  <div className="text-xs text-slate-500">{o.customerName ?? "—"}</div>
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  Skapad {o.createdAt ? new Date(o.createdAt).toLocaleString("sv-SE") : "—"}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
