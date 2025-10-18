"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useParams } from "next/navigation";
import { useOrderRealtime } from "@/lib/useOrderRealtime";
import {
  STATUS_COLORS,
  STATUS_DISPLAY,
  type TrackStatus,
} from "@/lib/orderStatus";
import CalendarMount from "@/components/CalendarMount";
import { APP_TRACKS, TRACK_NAMES, type AppTrack } from "@/lib/tracks";

import { OrdinaLogoSpinner } from "@/components/OrdinaLoader";
import { formatMinutesLabel } from "@/lib/time";
type TrackType = AppTrack | "SHARED";
type Track = AppTrack;

type FileItem = {
  id: string;
  filename: string;
  url: string;
  track: AppTrack | "SHARED";
  createdAt: number | string;
  expiresAt?: number;
};

type OrderData = {
  orderNumber: string | number;
  title: string;
  customerName?: string | null;
  tracks: { track: Track; status: TrackStatus; timeSpentMinutes: number }[];
  files: FileItem[];
};

const TRACK_LABELS: Record<AppTrack, string> = {
  A: TRACK_NAMES.A,
  B: TRACK_NAMES.B,
  C: TRACK_NAMES.C,
  D: TRACK_NAMES.D,
};

export default function OrderPage() {
  const { id } = useParams<{ id: string }>();
  const orderId = String(id ?? "");
  const [data, setData] = useState<OrderData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [track, setTrack] = useState<TrackType>("SHARED");
  const [loading, setLoading] = useState(false);

  const [calendarTrack, setCalendarTrack] = useState<Track>(APP_TRACKS[0]);

  async function load() {
    if (!orderId) return;
    setErr(null);
    try {
      const res = await fetch(`/api/orders/${orderId}`, { cache: "no-store" });
      if (!res.ok) {
        const msg = await res.text();
        setErr(`Kunde inte hämta order (${res.status}): ${msg}`);
        setData(null);
        return;
      }
      const json = await res.json();
      setData(json.order as OrderData);
    } catch (e: any) {
      console.error(e);
      setErr("Tekniskt fel när order skulle hämtas.");
    }
  }

  useEffect(() => {
    load();
  }, [orderId]);

  // Realtime file updates
  useOrderRealtime<FileItem, { id: string }>(
    orderId,
    (incoming) => {
      setData((prev) => {
        if (!prev) return prev;
        const already = prev.files.some(
          (f) => f.id === incoming.id || f.url === incoming.url
        );
        if (already) return prev;
        return { ...prev, files: [incoming, ...prev.files] };
      });
    },
    ({ id }) => {
      setData((prev) =>
        prev ? { ...prev, files: prev.files.filter((f) => f.id !== id) } : prev
      );
    }
  );

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !orderId) return;
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("track", track);
      const res = await fetch(`/api/orders/${orderId}/files`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const msg = await res.text();
        alert(`Uppladdning misslyckades: ${msg}`);
        return;
      }
      await res.json();
      setFile(null);
    } catch (e) {
      console.error(e);
      alert("Tekniskt fel vid uppladdning.");
    } finally {
      setLoading(false);
    }
  }

  async function deleteFile(fileId: string, filename: string) {
    if (!orderId) return;
    if (
      !confirm(
        `Är du säker på att du vill ta bort filen "${filename}"? Detta går inte att ångra.`
      )
    )
      return;
    const res = await fetch(`/api/orders/${orderId}/files/${fileId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const msg = await res.text();
      alert(`Kunde inte ta bort filen: ${msg}`);
      return;
    }
    setData((prev) =>
      prev ? { ...prev, files: prev.files.filter((f) => f.id !== fileId) } : prev
    );
  }

  async function setStatus(t: Track, status: TrackStatus) {
    if (!orderId) return;
    const res = await fetch(`/api/orders/${orderId}/tracks/${t}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      const msg = await res.text();
      alert(`Kunde inte byta status: ${msg}`);
      return;
    }
    await load();
  }

  if (err) return <div className="p-6 text-red-600">{err}</div>;
  if (!data)
    return (
      <div className="flex min-h-[200px] items-center justify-center p-6">
        <div className="flex items-center gap-3 text-neutral-600">
          <OrdinaLogoSpinner size={40} />
          <span>Laddar order</span>
        </div>
      </div>
    );

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          Order #{data.orderNumber} – {data.title}
        </h1>
        <p className="text-gray-600">Kund: {data.customerName ?? "-"}</p>
      </div>

      {/* Track status cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {APP_TRACKS.map((t) => {
          const trackRow = data.tracks.find((x) => x.track === t);
          const currentStatus = trackRow?.status as TrackStatus | undefined;
          const timeSpent = trackRow?.timeSpentMinutes ?? 0;
          const timeLabel = formatMinutesLabel(timeSpent);
          return (
            <div key={t} className="border rounded p-3 space-y-3">
              <div>
                <div className="font-semibold">{TRACK_LABELS[t]}</div>

                <div className="mt-2 flex items-center gap-2 text-sm">
                  <span className="text-gray-600">Status:</span>
                  {currentStatus ? (
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-semibold border ${STATUS_COLORS[currentStatus]}`}
                    >
                      {STATUS_DISPLAY[currentStatus]}
                    </span>
                  ) : (
                    <span className="font-medium text-gray-700">Ingen status</span>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-brand-100 bg-brand-50/70 px-3 py-2">
                <div className="text-xs font-medium uppercase tracking-wide text-brand-700">
                  Tid loggad
                </div>
                <motion.span
                  key={`${t}-${timeSpent}`}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className="text-sm font-semibold text-brand-900"
                >
                  {timeLabel}
                </motion.span>
              </div>

              <div className="flex flex-wrap gap-2">
                {(
                  ["INKOMMANDE", "PAGAENDE", "LEVERANS", "PALACK", "AVSLUTAD"] as const
                ).map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatus(t, s)}
                    className={`text-xs border px-2 py-1 rounded transition
                      ${STATUS_COLORS[s]}
                      ${s === currentStatus ? "ring-2 ring-black/10" : "hover:bg-neutral-100"}`}
                  >
                    {STATUS_DISPLAY[s]}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Upload */}
      <form onSubmit={upload} className="border rounded p-4 space-y-3">
        <div className="font-semibold">Ladda upp fil</div>

        <div className="flex flex-wrap items-center gap-3">
          <input
            id="fileInput"
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="hidden"
          />

          <button
            type="button"
            onClick={() => (document.getElementById("fileInput") as HTMLInputElement)?.click()}
            className="px-4 py-2 rounded-lg bg-brand-600 text-white hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-400 transition"
          >
            {file ? `Vald: ${file.name}` : "Välj fil"}
          </button>

          <select
            value={track}
            onChange={(e) => setTrack(e.target.value as TrackType)}
            className="border p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            <option value="SHARED">Delad</option>
            {APP_TRACKS.map((t) => (
              <option key={t} value={t}>
                {TRACK_LABELS[t]}
              </option>
            ))}
          </select>

          <button
            type="submit"
            disabled={loading || !file}
            className="px-4 py-2 rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-brand-400 transition"
          >
            {loading ? (
              <div className="flex items-center gap-2">
                <OrdinaLogoSpinner size={20} />
                <span>Laddar</span>
              </div>
            ) : (
              "Ladda upp"
            )}
          </button>
        </div>
      </form>

      {/* Files */}
      <div className="grid md:grid-cols-3 gap-4">
        {data.files.length === 0 && (
          <div className="text-gray-600">Inga filer än.</div>
        )}
        {data.files.map((f) => (
          <div key={f.id} className="border rounded p-3 hover:bg-gray-50">
            <div className="text-sm text-gray-500">Spår: {f.track}</div>
            <a
              href={f.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium break-all underline"
            >
              {f.filename}
            </a>
            <div className="text-xs text-gray-500">
              {new Date(f.createdAt).toLocaleString("sv-SE")}
            </div>
            <button
              onClick={() => deleteFile(f.id, f.filename)}
              className="mt-2 text-xs rounded border px-2 py-1 bg-error-50 border-error-300 text-error-800 hover:bg-error-100"
            >
              Ta bort
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
