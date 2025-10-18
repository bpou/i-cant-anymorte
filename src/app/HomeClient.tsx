// src/app/HomeClient.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  ClipboardCheck,
  LayoutDashboard,
  Lightbulb,
  PlusCircle,
  type LucideIcon,
} from "lucide-react";

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

const QUICK_LINK_META: Record<
  QuickLinkKey,
  { title: string; description: string; href: string; icon: LucideIcon; accent: string }
> = {
  new: {
    title: "Skapa order",
    description: "Starta ett nytt uppdrag på några sekunder",
    href: "/orders/new",
    icon: PlusCircle,
    accent: "bg-brand-50 text-brand-700 border border-brand-100",
  },
  overview: {
    title: "Orderöversikt",
    description: "Få en filtrerbar lista på alla ordrar",
    href: "/orders/overview",
    icon: LayoutDashboard,
    accent: "bg-sky-50 text-sky-700 border border-sky-100",
  },
  completed: {
    title: "Att fakturera",
    description: "Säkra att färdiga uppdrag faktureras i tid",
    href: "/orders/completed",
    icon: ClipboardCheck,
    accent: "bg-emerald-50 text-emerald-700 border border-emerald-100",
  },
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

type ChipDef = { key: Status; title: string };

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
      { key: "INKOMMANDE", title: "Inkommande" },
      { key: "PAGAENDE", title: "Pågående" },
      { key: "LEVERANS", title: "Leverans" },
      { key: "AVSLUTAD", title: "Avslutade" },
    ],
    []
  );

  const visibleChips = chips.filter((c) => perms.kpis.includes(c.key));

  const firstName = name.split(" ")[0];

  return (
    <div className="bg-[radial-gradient(circle_at_top,_rgba(28,155,241,0.08),_transparent_55%)]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-10 sm:px-6 lg:px-10">
        <header className="rounded-3xl border border-brand-100/70 bg-white px-7 py-9 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.45)]">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-brand-100 bg-brand-50/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-brand-600">
                Välkommen tillbaka
              </span>
              <div className="space-y-2">
                <h1 className="text-3xl font-semibold text-neutral-900 sm:text-4xl">Hej {firstName}!</h1>
                <p className="max-w-2xl text-sm leading-relaxed text-neutral-600">
                  {ROLE_GREETINGS[role]} Här får du en tydlig överblick över vad som behöver din uppmärksamhet i dag och genvägar till dina viktigaste uppgifter.
                </p>
              </div>
            </div>
            <div className="flex w-full max-w-sm items-start gap-3 rounded-2xl border border-brand-100 bg-brand-50/40 p-4 text-sm text-neutral-600">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-brand-600">
                <Lightbulb className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="space-y-1">
                <p className="font-semibold text-neutral-900">Snabbtips</p>
                <p>Markera ordrar som &ldquo;hela&rdquo; för att tydligare se vad som väntar på fakturering.</p>
              </div>
            </div>
          </div>
        </header>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Snabbåtgärder">
          {perms.quickLinks.map((key) => {
            const meta = QUICK_LINK_META[key];
            const Icon = meta.icon;

            return (
              <Link
                key={key}
                href={meta.href}
                className="group relative flex h-full flex-col justify-between overflow-hidden rounded-2xl border border-brand-100 bg-white p-5 shadow-[0_18px_35px_-28px_rgba(15,23,42,0.45)] transition-all duration-200 hover:-translate-y-1 hover:border-brand-200 hover:shadow-[0_30px_60px_-40px_rgba(15,23,42,0.45)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400"
              >
                <span className={`inline-flex h-11 w-11 items-center justify-center rounded-full ${meta.accent}`}>
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="mt-4 space-y-1">
                  <p className="text-base font-semibold text-neutral-900">{meta.title}</p>
                  <p className="text-sm text-neutral-600">{meta.description}</p>
                </div>
                <div className="mt-5 flex items-center justify-between text-xs font-medium text-brand-500">
                  <span className="inline-flex items-center gap-1">
                    Gå till sidan
                    <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" aria-hidden="true" />
                  </span>
                  {key === "completed" && (
                    <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-[11px] text-emerald-700">
                      {toInvoice === null ? (
                        <>
                          <OrdinaLogoSpinner size={16} />
                          <span>Laddar…</span>
                        </>
                      ) : (
                        `${toInvoice} ${toInvoice === 1 ? "order" : "ordrar"}`
                      )}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}

          {perms.trackLinks.map((track) => (
            <Link
              key={track}
              href={`/orders/track/${track}`}
              className="group relative overflow-hidden rounded-2xl border border-brand-100 bg-white p-5 shadow-[0_18px_35px_-28px_rgba(15,23,42,0.45)] transition-all duration-200 hover:-translate-y-1 hover:border-brand-200 hover:shadow-[0_30px_60px_-40px_rgba(15,23,42,0.45)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400"
            >
              <span className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
                Spår {track}
              </span>
              <div className="mt-4 space-y-1">
                <p className="text-lg font-semibold text-neutral-900">{TRACK_DISPLAY[track]}</p>
                <p className="text-sm text-neutral-600">{trackSummaryCopy(track)}</p>
              </div>
              <ArrowRight className="absolute right-5 top-5 h-5 w-5 text-brand-300 transition group-hover:translate-x-1" aria-hidden="true" />
            </Link>
          ))}
        </section>

        <section className="rounded-3xl border border-brand-100/80 bg-white p-6 shadow-[0_24px_70px_-48px_rgba(15,23,42,0.6)]" aria-label="Status i realtid">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-neutral-900">Status i realtid</h2>
              <p className="text-sm text-neutral-600">Direkt från orderflödet i dina spår.</p>
            </div>
            {quickLinkSet.has("new") && (
              <p className="text-xs text-neutral-500">Tips: använd etiketten &ldquo;hel&rdquo; för att tydliggöra fakturering.</p>
            )}
          </div>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {visibleChips.map((c) => {
              const total = loading ? undefined : (summary[c.key] ?? 0);
              const indiv = loading ? undefined : (individuals[c.key] ?? 0);
              const label = indiv === undefined ? null : indiv === 0 ? "Inga hela" : `${indiv} ${indiv === 1 ? "hel" : "hela"}`;
              const parts = STATUS_COLOR_PARTS[c.key];

              return (
                <div
                  key={c.key}
                  className="flex h-full flex-col justify-between rounded-2xl border border-brand-100 bg-gradient-to-br from-white via-white to-brand-50/60 p-5 shadow-[0_14px_40px_-32px_rgba(15,23,42,0.55)] transition hover:-translate-y-1 hover:shadow-[0_28px_60px_-45px_rgba(15,23,42,0.55)]"
                >
                  <span
                    className={`inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${parts.textClass} ${parts.borderClass}`}
                    style={{ backgroundColor: `${parts.bgHex}55` }}
                  >
                    {c.title}
                  </span>
                  <div className="mt-6 flex items-end justify-between gap-3">
                    <span className="text-3xl font-semibold text-neutral-900">{total === undefined ? "…" : total}</span>
                    {quickLinkSet.has("new") && label && (
                      <span className="text-xs text-neutral-600">{label}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {perms.trackCards.length > 0 && (
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Spårkort">
            {perms.trackCards.map((track) => (
              <Link
                key={track}
                href={`/orders/track/${track}`}
                className="group rounded-2xl border border-brand-100 bg-white p-5 shadow-[0_18px_35px_-28px_rgba(15,23,42,0.45)] transition-all duration-200 hover:-translate-y-1 hover:border-brand-200 hover:shadow-[0_30px_60px_-40px_rgba(15,23,42,0.45)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-brand-600">Spår {track}</p>
                    <p className="text-lg font-semibold text-neutral-900">{TRACK_DISPLAY[track]}</p>
                    <p className="text-sm text-neutral-600">{trackSummaryCopy(track)}</p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-brand-300 transition group-hover:translate-x-1" aria-hidden="true" />
                </div>
              </Link>
            ))}
          </section>
        )}

        {perms.showRecent && (
          <section className="rounded-3xl border border-brand-100 bg-white shadow-[0_24px_70px_-48px_rgba(15,23,42,0.6)]">
            <div className="flex items-center justify-between border-b border-brand-100/70 px-6 py-5">
              <div>
                <h2 className="text-lg font-semibold text-neutral-900">Senaste ordrar</h2>
                <p className="text-sm text-neutral-600">Ett snapshot över vad som hänt den senaste tiden.</p>
              </div>
              <Link
                href="/orders/overview"
                className="inline-flex items-center gap-2 text-sm font-semibold text-brand-600 transition hover:text-brand-700"
              >
                Visa alla
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
            <div className="divide-y divide-brand-100/70">
              {loading && (
                <div className="flex items-center gap-3 px-6 py-5 text-neutral-500">
                  <OrdinaLogoSpinner size={28} />
                  <span>Laddar senaste ordrar</span>
                </div>
              )}
              {!loading && recent.length === 0 && (
                <div className="px-6 py-5 text-neutral-500">Inga ordrar ännu.</div>
              )}
              {recent.map((o) => (
                <Link
                  key={o.orderNumber}
                  href={`/orders/${o.orderNumber}`}
                  className="flex items-center justify-between gap-4 px-6 py-5 transition hover:bg-brand-50/60"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-neutral-900">#{o.orderNumber} – {o.title}</p>
                    <p className="mt-1 text-xs text-neutral-500">
                      Skapad {o.createdAt ? new Date(o.createdAt).toLocaleString("sv-SE") : "-"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-neutral-500">
                    <span className="truncate">{o.customerName ?? "-"}</span>
                    <ArrowRight className="h-4 w-4 text-brand-300" aria-hidden="true" />
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}



