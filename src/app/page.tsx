// src/app/page.tsx
import { getServerSession } from "next-auth";
import Link from "next/link";
import { Sparkles, CheckCircle2 } from "lucide-react";

import { authOptions } from "@/lib/auth";
import HomeClient from "./HomeClient";

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role as "ADMIN"|"SALJARE"|"A_TEAM"|"B_TEAM"|undefined;

  // Ej inloggad – visa enkel hero
  if (!session) {
    return (
      <div className="relative overflow-hidden bg-gradient-to-b from-white via-brand-50/40 to-white">
        <div className="pointer-events-none absolute inset-y-0 left-[-15%] -z-10 h-[320px] w-[320px] rounded-full bg-brand-200/50 blur-3xl sm:left-[-10%] sm:h-[380px] sm:w-[380px]" />
        <div className="pointer-events-none absolute -right-16 top-10 -z-10 hidden h-[420px] w-[420px] rounded-[36px] border border-brand-200/60 bg-white/60 shadow-[0_40px_100px_-40px_rgba(15,23,42,0.35)] backdrop-blur-xl lg:block" />
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-16 px-6 py-20 sm:px-12 lg:flex-row lg:items-center">
          <div className="max-w-2xl space-y-8 text-center lg:text-left">
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white px-4 py-1 text-sm font-medium text-brand-700 shadow-soft">
              <Sparkles className="h-4 w-4 text-brand-600" aria-hidden="true" />
              Ordina gör orderhantering enkelt
            </span>
            <h1 className="text-4xl font-semibold leading-tight text-neutral-900 sm:text-5xl">
              Planera, följ upp och fakturera med full kontroll
            </h1>
            <p className="text-lg text-neutral-600">
              Vårt digitala ordersystem samlar allt du behöver i en modern arbetsyta – från arbetsorder till fakturering. Få överblick över pågående projekt, involvera teamet och håll kunderna uppdaterade utan extra administration.
            </p>
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-xl bg-brand-600 px-6 py-3 text-base font-semibold text-white shadow-lg shadow-brand-500/25 transition hover:-translate-y-0.5 hover:bg-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-300"
              >
                Logga in och kom igång
              </Link>
              <Link
                href="/home"
                className="inline-flex items-center justify-center rounded-xl border border-brand-200/80 bg-white px-6 py-3 text-base font-semibold text-brand-700 transition hover:border-brand-300 hover:text-brand-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-200"
              >
                Utforska plattformen
              </Link>
            </div>
            <ul className="grid gap-4 pt-4 text-left sm:grid-cols-2">
              {[
                {
                  title: "Snabb orderöversikt",
                  description: "Se status på alla jobb och vem som ansvarar – utan att öppna separata system.",
                },
                {
                  title: "Smart schemaläggning",
                  description: "Planera resurser med drag och släpp och få automatiska påminnelser.",
                },
                {
                  title: "Smidig fakturering",
                  description: "Generera fakturaunderlag direkt från utfört arbete – alltid korrekt och komplett.",
                },
                {
                  title: "Säker delning",
                  description: "Ge kunder och kollegor rätt åtkomst med tvåfaktorsinloggning och loggning.",
                },
              ].map((feature) => (
                <li
                  key={feature.title}
                  className="flex items-start gap-3 rounded-2xl border border-brand-100 bg-white p-4 shadow-soft"
                >
                  <CheckCircle2 className="mt-1 h-5 w-5 text-brand-600" aria-hidden="true" />
                  <div className="space-y-1 text-sm">
                    <p className="font-semibold text-neutral-900">{feature.title}</p>
                    <p className="text-neutral-600">{feature.description}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div className="mx-auto w-full max-w-sm rounded-3xl border border-brand-100 bg-white p-8 text-left shadow-[0_25px_80px_-30px_rgba(15,23,42,0.2)]">
            <div className="space-y-6">
              <div className="space-y-1">
                <p className="text-sm font-medium uppercase tracking-widest text-brand-600">Ögonblicksbild</p>
                <p className="text-2xl font-semibold text-neutral-900">Teamets dag i fokus</p>
              </div>
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <div className="rounded-2xl border border-brand-100 bg-brand-50/70 p-4">
                  <dt className="text-sm font-medium text-neutral-600">Aktiva jobb</dt>
                  <dd className="mt-1 text-2xl font-semibold text-neutral-900">18</dd>
                </div>
                <div className="rounded-2xl border border-brand-100 bg-brand-50/70 p-4">
                  <dt className="text-sm font-medium text-neutral-600">Leveranser idag</dt>
                  <dd className="mt-1 text-2xl font-semibold text-neutral-900">6</dd>
                </div>
                <div className="rounded-2xl border border-brand-100 bg-brand-50/70 p-4">
                  <dt className="text-sm font-medium text-neutral-600">Meddelanden</dt>
                  <dd className="mt-1 text-2xl font-semibold text-neutral-900">12</dd>
                </div>
                <div className="rounded-2xl border border-brand-100 bg-brand-50/70 p-4">
                  <dt className="text-sm font-medium text-neutral-600">Fakturor klara</dt>
                  <dd className="mt-1 text-2xl font-semibold text-neutral-900">4</dd>
                </div>
              </dl>
              <p className="text-sm text-neutral-600">
                All data uppdateras i realtid och visas i tydliga kort. När du loggar in möts du av en arbetsyta som hjälper dig prioritera rätt saker.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <HomeClient
      name={session.user?.name ?? "Användare"}
      role={role ?? "SALJARE"}
    />
  );
}
