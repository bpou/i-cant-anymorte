"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useOrderRealtime } from "@/lib/useOrderRealtime";

/* ---------- Typer ---------- */

type Track = "A" | "B";
type TrackType = "A" | "B" | "SHARED";

type FileItem = {
  id: string;
  filename: string;
  url: string;          // presigned GET-url
  track: TrackType;
  createdAt: string | number;
  expiresAt?: number;   // ms epoch (server sätter)
};

type TrackRow = {
  track: Track;
  status: "INKOMMANDE" | "PAGAENDE" | "LEVERANS" | "AVSLUTAD";
};

type OrderData = {
  orderNumber: string | number;
  title: string;
  customerName?: string | null;
  createdAt?: string | null;
  tracks: TrackRow[];
  files: FileItem[];
};

const TRACK_STATUS_COLORS: Record<TrackRow["status"], string> = {
  INKOMMANDE: "bg-amber-100 text-amber-900 border-amber-300",
  PAGAENDE:   "bg-sky-100 text-sky-900 border-sky-300",
  LEVERANS:   "bg-purple-100 text-purple-900 border-purple-300",
  AVSLUTAD:   "bg-emerald-100 text-emerald-900 border-emerald-300",
};

const FILE_RENEW_BUFFER_MS = 60_000; // förnya 60s innan utgång

/* ---------- Hjälp: enkel förhandsvisning ---------- */

function FilePreview({ url, filename }: { url: string; filename: string }) {
  const lower = filename.toLowerCase();
  if (/\.(png|jpe?g|gif|webp|bmp|svg)$/.test(lower)) {
    return (
      <img
        src={url}
        alt={filename}
        className="mt-2 max-h-64 w-auto rounded border"
      />
    );
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

  /* ---------- Realtime ---------- */
  useOrderRealtime<FileItem, { id: string }>(
    id,
    (incoming: FileItem) => {
      // visa bara om det gäller aktuellt spår eller delad
      if (!(incoming.track === track || incoming.track === "SHARED")) return;
      setData((prev: OrderData | null) => {
        if (!prev) return prev;
        const already = prev.files.some(
          (f: FileItem) => f.id === incoming.id || f.url === incoming.url
        );
        if (already) return prev;
        return { ...prev, files: [incoming, ...prev.files] };
      });
    },
    (payload: { id: string }) => {
      setData((prev: OrderData | null) =>
        prev ? { ...prev, files: prev.files.filter((f: FileItem) => f.id !== payload.id) } : prev
      );
    }
  );

  /* ---------- Filtrering: mitt spår + SHARED ---------- */
  const visibleFiles: FileItem[] = useMemo<FileItem[]>(
    () =>
      (data?.files ?? []).filter(
        (f: FileItem) => f.track === track || f.track === "SHARED"
      ),
    [data?.files, track]
  );

  /* ---------- Auto-förnya presigned URLs ---------- */
  useEffect(() => {
    if (!visibleFiles.length) return;

    const now = Date.now();
    const soonest: number = visibleFiles
      .map((f: FileItem) =>
        typeof f.expiresAt === "number" ? f.expiresAt : now + 3_600_000
      )
      .reduce((min: number, x: number) => Math.min(min, x), now + 3_600_000);

    const delay = Math.max(0, soonest - FILE_RENEW_BUFFER_MS - now);

    const t = setTimeout(async () => {
      try {
        const ids: string[] = visibleFiles.map((f: FileItem) => f.id);
        const res = await fetch(`/api/orders/${id}/files/renew`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids }),
        });
        if (!res.ok) return;

        const json: { urls: { id: string; url: string; expiresAt: number }[] } =
          await res.json();
        const map = new Map<string, { id: string; url: string; expiresAt: number }>(
          json.urls.map((u) => [u.id, u])
        );

        setData((prev: OrderData | null) =>
          prev
            ? {
                ...prev,
                files: prev.files.map((f: FileItem) =>
                  map.has(f.id)
                    ? {
                        ...f,
                        url: map.get(f.id)!.url,
                        expiresAt: map.get(f.id)!.expiresAt,
                      }
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
    // uppdatera när de synliga filernas giltighet ändras
    JSON.stringify(
      visibleFiles.map((f: FileItem) => ({ id: f.id, exp: f.expiresAt ?? 0 }))
    ),
  ]);

  /* ---------- Upload ---------- */
  async function upload(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("track", track); // lås till aktivt spår
      const res = await fetch(`/api/orders/${id}/files`, { method: "POST", body: fd });
      if (!res.ok) {
        const msg = await res.text();
        alert(`Uppladdning misslyckades: ${msg}`);
        return;
      }
      // ingen optimistisk uppdatering – Pusher sköter båda flikarna
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
    // Optimistiskt här – andra flikar uppdateras via Pusher
    setData((prev: OrderData | null) =>
      prev ? { ...prev, files: prev.files.filter((f: FileItem) => f.id !== fileId) } : prev
    );
  }

  /* ---------- Render ---------- */

  if (err) return <div className="p-6 text-red-600">{err}</div>;
  if (loading) return <div className="p-6">Laddar…</div>;
  if (!data) return <div className="p-6">Ingen data</div>;

  const trackData = data.tracks.find((t: TrackRow) => t.track === track);

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

      <div className="border rounded p-4">
        <h2 className="font-semibold mb-2">Spår {track}</h2>
        <div className="mb-3">
          Status:{" "}
          {trackData?.status ? (
            <span
              className={`px-2 py-1 rounded-full text-xs font-semibold border ${TRACK_STATUS_COLORS[trackData.status]}`}
            >
              {trackData.status}
            </span>
          ) : (
            "—"
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
            className="px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700
                       focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
          >
            {file ? `Vald: ${file.name}` : "Välj fil"}
          </button>
          <button
            type="submit"
            disabled={uploading || !file}
            className="px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700
                       disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-emerald-400 transition"
          >
            {uploading ? "Laddar…" : "Ladda upp"}
          </button>
        </form>
      </div>

      <div className="border rounded p-4">
        <h2 className="font-semibold mb-3">
          Filer för spår {track} (inkl. Delad)
        </h2>
        {visibleFiles.length === 0 && (
          <div className="text-gray-600">Inga filer än.</div>
        )}
        <div className="grid gap-6">
          {visibleFiles.map((f: FileItem) => (
            <div key={f.id} className="border rounded p-3 hover:bg-gray-50 transition">
              <div className="text-sm text-gray-500 mb-1">Spår: {f.track}</div>
              <div className="font-medium break-all">
                <a
                  href={f.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  {f.filename}
                </a>
              </div>
              <div className="text-xs text-gray-500 mb-2">
                Uppladdad: {new Date(f.createdAt).toLocaleString("sv-SE")}
              </div>
              <FilePreview url={f.url} filename={f.filename} />
              <button
                onClick={() => void deleteFile(f.id, f.filename)}
                className="mt-2 text-xs rounded border px-2 py-1 bg-rose-50 border-rose-300 text-rose-800 hover:bg-rose-100"
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
