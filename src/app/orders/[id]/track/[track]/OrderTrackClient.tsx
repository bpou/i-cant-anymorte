"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useOrderRealtime } from "@/lib/useOrderRealtime";
import type { AppTrack } from "@/lib/tracks";
import {
  STATUS_COLORS,
  STATUS_DISPLAY,
  ALL_STATUSES,
  type TrackStatus
} from "@/lib/orderStatus";
import { OrdinaLogoSpinner } from "@/components/OrdinaLoader";
import { formatMinutesLabel } from "@/lib/time";

/* ---------- Typer ---------- */
type Track = AppTrack;
type TrackType = AppTrack | "SHARED";

type FileItem = {
  id: string;
  filename: string;
  url: string;          // presigned GET-url
  track: TrackType;
  createdAt: string | number;
  expiresAt?: number;   // ms epoch
};

type TrackRow = {
  track: Track;
  status: "INKOMMANDE" | "PAGAENDE" | "LEVERANS" | "AVSLUTAD";
  timeSpentMinutes: number;
};

type OrderData = {
  orderNumber: string | number;
  title: string;
  customerName?: string | null;
  createdAt?: string | null;
  tracks: TrackRow[];
  files: FileItem[];
};

const FILE_RENEW_BUFFER_MS = 60_000;

/* ---------- Hjälp: enkel förhandsvisning ---------- */
function FilePreview({ url, filename }: { url: string; filename: string }) {
  const lower = filename.toLowerCase();
  if (/\.(png|jpe?g|gif|webp|bmp|svg)$/.test(lower)) {
    return <img src={url} alt={filename} className="mt-2 max-h-64 w-auto rounded border" />;
  }
  if (lower.endsWith(".pdf")) {
    return <iframe src={url} className="mt-2 w-full h-[500px] border rounded" />;
  }
  return null;
}

/* ---------- Komponent ---------- */
export default function OrderTrackClient({
  id,
  track,
}: {
  id: string;
  track: Track;
}) {
  const [data, setData] = useState<OrderData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);
  const [hoursInput, setHoursInput] = useState<string>("");
  const [minutesInput, setMinutesInput] = useState<string>("");
  const [savingTime, setSavingTime] = useState<boolean>(false);
  const [timeError, setTimeError] = useState<string | null>(null);
  const [lastAddedMinutes, setLastAddedMinutes] = useState<number | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setErr(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/orders/${id}`, { cache: "no-store" });
      if (!res.ok) {
        const msg = await res.text();
        setErr(`Kunde inte hämta order (${res.status}): ${msg}`);
        setData(null);
        return;
      }
      const json: { order: OrderData } = await res.json();
      setData(json.order);
    } catch {
      setErr("Tekniskt fel när order skulle hämtas.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load, track]);

  useEffect(() => {
    if (lastAddedMinutes === null) return;
    const timer = window.setTimeout(() => setLastAddedMinutes(null), 3200);
    return () => window.clearTimeout(timer);
  }, [lastAddedMinutes]);

  useEffect(() => {
    setHoursInput("");
    setMinutesInput("");
    setTimeError(null);
  }, [track]);

  async function submitTime(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (savingTime) return;

    const hoursRaw = Number.parseInt(hoursInput.trim() || "0", 10);
    const minutesRaw = Number.parseInt(minutesInput.trim() || "0", 10);
    const safeHours = Number.isFinite(hoursRaw) ? Math.max(0, Math.min(999, hoursRaw)) : 0;
    const safeMinutes = Number.isFinite(minutesRaw) ? Math.max(0, minutesRaw) : 0;
    const totalMinutes = safeHours * 60 + safeMinutes;

    if (totalMinutes <= 0) {
      setTimeError("Ange en tid större än noll.");
      return;
    }
    if (totalMinutes > 24 * 60) {
      setTimeError("Max 24 timmar kan registreras per tillfälle.");
      return;
    }

    setSavingTime(true);
    setTimeError(null);
    try {
      const res = await fetch(`/api/orders/${id}/tracks/${track}/time`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minutes: totalMinutes }),
      });

      const payloadText = await res.text();
      let payload: any = null;
      if (payloadText) {
        try {
          payload = JSON.parse(payloadText);
        } catch {
          /* ignore parse error */
        }
      }

      if (!res.ok) {
        const message =
          (typeof payload?.error === "string" && payload.error.trim().length > 0)
            ? payload.error
            : "Kunde inte spara tiden just nu.";
        setTimeError(message);
        return;
      }

      const updatedMinutes =
        typeof payload?.track?.timeSpentMinutes === "number"
          ? payload.track.timeSpentMinutes
          : totalMinutes;
      const minutesAdded =
        typeof payload?.minutesAdded === "number" && payload.minutesAdded > 0
          ? payload.minutesAdded
          : totalMinutes;

      setData((prev) =>
        prev
          ? {
              ...prev,
              tracks: prev.tracks.map((t) =>
                t.track === track ? { ...t, timeSpentMinutes: updatedMinutes } : t
              ),
            }
          : prev
      );

      setHoursInput("");
      setMinutesInput("");
      setLastAddedMinutes(minutesAdded);
    } catch (error) {
      console.error("Failed to submit time", error);
      setTimeError("Tekniskt fel vid sparande av tid.");
    } finally {
      setSavingTime(false);
    }
  }

  /* ---------- Realtime ---------- */
  useOrderRealtime<FileItem, { id: string }>(
    id,
    (incoming: FileItem) => {
      if (!(incoming.track === track || incoming.track === "SHARED")) return;
      setData((prev) => {
        if (!prev) return prev;
        const already = prev.files.some((f) => f.id === incoming.id || f.url === incoming.url);
        if (already) return prev;
        return { ...prev, files: [incoming, ...prev.files] };
      });
    },
    (payload: { id: string }) => {
      setData((prev) =>
        prev ? { ...prev, files: prev.files.filter((f) => f.id !== payload.id) } : prev
      );
    }
  );

  /* ---------- Filtrering: mitt spår + SHARED ---------- */
  const visibleFiles = useMemo(
    () => (data?.files ?? []).filter((f) => f.track === track || f.track === "SHARED"),
    [data?.files, track]
  );

  /* ---------- Auto-förnya presigned URLs ---------- */
  useEffect(() => {
    if (!visibleFiles.length) return;

    const now = Date.now();
    const soonest = visibleFiles
      .map((f) => (typeof f.expiresAt === "number" ? f.expiresAt : now + 3_600_000))
      .reduce((min, x) => Math.min(min, x), now + 3_600_000);

    const delay = Math.max(0, soonest - FILE_RENEW_BUFFER_MS - now);

    const t = setTimeout(async () => {
      try {
        const ids = visibleFiles.map((f) => f.id);
        const res = await fetch(`/api/orders/${id}/files/renew`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids }),
        });
        if (!res.ok) return;

        const json: { urls: { id: string; url: string; expiresAt: number }[] } = await res.json();
        const map = new Map(json.urls.map((u) => [u.id, u]));

        setData((prev) =>
          prev
            ? {
                ...prev,
                files: prev.files.map((f) =>
                  map.has(f.id)
                    ? { ...f, url: map.get(f.id)!.url, expiresAt: map.get(f.id)!.expiresAt }
                    : f
                ),
              }
            : prev
        );
      } catch {
        /* ignore */
      }
    }, delay);

    return () => clearTimeout(t);
  }, [
    id,
    JSON.stringify(visibleFiles.map((f) => ({ id: f.id, exp: f.expiresAt ?? 0 }))),
  ]);

  /* ---------- Upload ---------- */
  async function upload(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("track", track);
      const res = await fetch(`/api/orders/${id}/files`, { method: "POST", body: fd });
      if (!res.ok) {
        const msg = await res.text();
        alert(`Uppladdning misslyckades: ${msg}`);
        return;
      }
      await res.json();
      setFile(null);
    } catch {
      alert("Tekniskt fel vid uppladdning.");
    } finally {
      setUploading(false);
    }
  }

  /* ---------- Delete ---------- */
  async function deleteFile(fileId: string, filename: string): Promise<void> {
    if (!confirm(`Är du säker på att du vill ta bort filen "${filename}"?`)) return;
    const res = await fetch(`/api/orders/${id}/files/${fileId}`, { method: "DELETE" });
    if (!res.ok) {
      const msg = await res.text();
      alert(`Kunde inte ta bort filen: ${msg}`);
      return;
    }
    setData((prev) =>
      prev ? { ...prev, files: prev.files.filter((f) => f.id !== fileId) } : prev
    );
  }

  /* ---------- Gate: blockera Montage (C) om Verkstad (B) inte klar ---------- */
  const verkstadRow = useMemo(
    () => data?.tracks.find((t) => t.track === "B"),
    [data?.tracks]
  );
  const montageBlocked = useMemo(() => {
    if (track !== "C") return false;
    // Tillåt när B är LEVERANS eller AVSLUTAD (justera här om du har annan logik)
    const ALLOWED_BEFORE_MONTAGE: TrackStatus[] = ["LEVERANS"];
    return !verkstadRow || !ALLOWED_BEFORE_MONTAGE.includes(verkstadRow.status);
  }, [track, verkstadRow]);

  /* ---------- Render ---------- */
  if (err) return <div className="p-6 text-red-600">{err}</div>;
  if (loading)
    return (
      <div className="flex min-h-[200px] items-center justify-center p-6">
        <div className="flex items-center gap-3 text-neutral-600">
          <OrdinaLogoSpinner size={36} />
          <span>Laddar orderdata</span>
        </div>
      </div>
    );
  if (!data) return <div className="p-6">Ingen data</div>;

  // Block view if montage not allowed
  if (montageBlocked) {
    const currentStatus = verkstadRow?.status ?? "saknas";
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-5">
          <h2 className="text-lg font-semibold text-amber-900">Åtkomst nekad till Montage (Spår C)</h2>
          <p className="mt-2 text-amber-900/90">
            Den här ordern är inte markerad som redo för montage ännu.
            <br />
            Krav: <strong>Verkstad (Spår B)</strong> måste vara i status{" "}
            <span className="font-semibold">LEVERANS</span> 
          </p>
          <p className="mt-2 text-sm text-amber-900/80">
            Nuvarande status för Verkstad (B): <strong>{currentStatus}</strong>
          </p>
          <div className="mt-4 flex gap-2">
            <a
              href={`/orders/${encodeURIComponent(String(data.orderNumber))}/track/B`}
              className="inline-flex items-center rounded-md border border-amber-300 bg-white px-3 py-1.5 text-sm font-medium text-amber-900 hover:bg-amber-100"
            >
              Öppna Verkstad (Spår B)
            </a>
            <a
              href={`/orders/${encodeURIComponent(String(data.orderNumber))}`}
              className="inline-flex items-center rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-gray-50"
            >
              Tillbaka till order
            </a>
          </div>
        </div>
      </div>
    );
  }

  const trackData = data.tracks.find((t) => t.track === track);
  const totalMinutesForTrack = trackData?.timeSpentMinutes ?? 0;
  const totalTimeLabel = formatMinutesLabel(totalMinutesForTrack);
  const trackStatus = trackData?.status;
  const recentAdditionLabel =
    lastAddedMinutes !== null ? formatMinutesLabel(lastAddedMinutes) : null;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          Order #{data.orderNumber} – {data.title}
        </h1>
        <p className="text-gray-600">Kund: {data.customerName ?? "-"}</p>
        {!!data.createdAt && (
          <p className="text-gray-500 text-sm mt-1">
            Skapad: {new Date(data.createdAt).toLocaleString("sv-SE")}
          </p>
        )}
      </div>

      <div className="border rounded p-4 space-y-5">
        <div>
          <h2 className="text-lg font-semibold">Spår {track}</h2>
          <div className="mt-2 flex items-center gap-2 text-sm text-gray-600">
            <span>Status:</span>
            {trackStatus ? (
              <span
                className={`px-2 py-1 rounded-full text-xs font-semibold border ${STATUS_COLORS[trackStatus]}`}
              >
                {STATUS_DISPLAY[trackStatus] ?? trackStatus}
              </span>
            ) : (
              <span className="font-medium text-gray-700">Ingen status</span>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-brand-100 bg-gradient-to-r from-brand-50 via-white to-brand-50/90 p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-brand-700">Registrerad tid</p>
              <p className="text-xs text-brand-600/80">Summering för spår {track}</p>
            </div>
            <motion.span
              key={totalMinutesForTrack}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="text-2xl font-semibold text-brand-900"
            >
              {totalTimeLabel}
            </motion.span>
          </div>

          <AnimatePresence>
            {lastAddedMinutes !== null && recentAdditionLabel && (
              <motion.div
                key={`added-${lastAddedMinutes}`}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
                className="mt-3 inline-flex items-center gap-2 rounded-full bg-brand-600/10 px-3 py-1 text-xs font-medium text-brand-700"
              >
                <span>+{recentAdditionLabel}</span>
                <span className="text-brand-500">tillagd</span>
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={submitTime} className="mt-4 flex flex-wrap items-end gap-3">
            <label className="flex flex-col text-xs font-medium text-brand-800">
              Timmar
              <input
                type="number"
                min="0"
                max="999"
                inputMode="numeric"
                value={hoursInput}
                onChange={(e) => {
                  const next = e.target.value.replace(/[^0-9]/g, "").slice(0, 3)
                  setHoursInput(next)
                }}
                placeholder="0"
                className="mt-1 w-24 rounded-lg border border-brand-200 bg-white px-3 py-2 text-sm focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-400"
              />
            </label>
            <label className="flex flex-col text-xs font-medium text-brand-800">
              Minuter
              <input
                type="number"
                min="0"
                max="1440"
                inputMode="numeric"
                value={minutesInput}
                onChange={(e) => {
                  const next = e.target.value.replace(/[^0-9]/g, "").slice(0, 4)
                  setMinutesInput(next)
                }}
                placeholder="30"
                className="mt-1 w-24 rounded-lg border border-brand-200 bg-white px-3 py-2 text-sm focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-400"
              />
            </label>
            <button
              type="submit"
              disabled={savingTime}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingTime ? (
                <>
                  <OrdinaLogoSpinner size={18} />
                  <span>Sparar</span>
                </>
              ) : (
                <span>Lägg till tid</span>
              )}
            </button>
          </form>

          <p className="mt-3 text-xs text-brand-600/70">Tiden adderas till den totala summeringen för spåret.</p>

          {timeError && (
            <div className="mt-3 rounded-md border border-error-200 bg-error-50 px-3 py-2 text-xs text-error-700">
              {timeError}
            </div>
          )}
        </div>

        {/* Filuppladdning */}
        <form onSubmit={upload} className="flex flex-wrap items-center gap-3">
          <input
            id="fileInput"
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => document.getElementById("fileInput")?.click()}
            className="px-4 py-2 rounded-lg bg-brand-600 text-white hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
          >
            {file ? `Vald: ${file.name}` : "Välj fil"}
          </button>
          <button
            type="submit"
            disabled={uploading || !file}
            className="px-4 py-2 rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-brand-400 transition"
          >
            {uploading ? (
              <div className="flex items-center gap-2">
                <OrdinaLogoSpinner size={20} />
                <span>Laddar</span>
              </div>
            ) : (
              'Ladda upp'
            )}
          </button>
        </form>
      </div>


      <div className="border rounded p-4">
        <h2 className="font-semibold mb-3">Filer för spår {track} (inkl. Delad)</h2>
        {visibleFiles.length === 0 && (
          <div className="text-gray-600">Inga filer än.</div>
        )}
        <div className="grid gap-6">
          {visibleFiles.map((f) => (
            <div key={f.id} className="border rounded p-3 hover:bg-gray-50 transition">
              <div className="text-sm text-gray-500 mb-1">Spår: {f.track}</div>
              <div className="font-medium break-all">
                <a href={f.url} target="_blank" rel="noopener noreferrer" className="underline">
                  {f.filename}
                </a>
              </div>
              <div className="text-xs text-gray-500 mb-2">
                Uppladdad: {new Date(f.createdAt).toLocaleString("sv-SE")}
              </div>
              <FilePreview url={f.url} filename={f.filename} />
              <button
                onClick={() => void deleteFile(f.id, f.filename)}
                className="mt-2 text-xs rounded border px-2 py-1 bg-error-50 border-error-300 text-error-800 hover:bg-error-100"
              >
                Ta bort
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
