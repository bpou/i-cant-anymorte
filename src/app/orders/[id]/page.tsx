"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useOrderRealtime } from "@/lib/useOrderRealtime";

type TrackType = "A" | "B" | "SHARED";
type Track = "A" | "B";

type FileItem = {
  id: string;
  filename: string;
  url: string;                 // signerad URL
  track: "A" | "B" | "SHARED";
  createdAt: number | string;
  expiresAt?: number;          // ms-epoch
};


type OrderData = {
  orderNumber: string | number;
  title: string;
  customerName?: string | null;
  tracks: { track: Track; status: "INKOMMANDE" | "PAGAENDE" | "LEVERANS" | "AVSLUTAD" }[];
  files: FileItem[];
};




const TRACK_STATUS_COLORS: Record<string, string> = {
  INKOMMANDE: "bg-amber-100 text-amber-900 border-amber-300",
  PAGAENDE:   "bg-sky-100 text-sky-900 border-sky-300",
  LEVERANS:   "bg-purple-100 text-purple-900 border-purple-300",
  AVSLUTAD:   "bg-emerald-100 text-emerald-900 border-emerald-300",
};

const TRACK_LABELS: Record<Track, string> = {
  A: "Ateljé",
  B: "Verkstad",
};

export default function OrderPage() {
  const { id } = useParams<{ id: string }>();
  const orderId = String(id ?? "");
  const [data, setData] = useState<OrderData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [track, setTrack] = useState<TrackType>("SHARED");
  const [loading, setLoading] = useState(false);

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

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [orderId]);

  // Realtid: lägg till fil när event kommer från Pusher (med dubblettskydd)
useOrderRealtime<FileItem, { id: string }>(
  orderId,
  // file:created
  (incoming) => {
    setData(prev => {
      if (!prev) return prev;
      const already = prev.files.some(f => f.id === incoming.id || f.url === incoming.url);
      if (already) return prev;
      return { ...prev, files: [incoming, ...prev.files] };
    });
  },
  // file:deleted
  ({ id }) => {
    setData(prev => (prev ? { ...prev, files: prev.files.filter(f => f.id !== id) } : prev));
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
      const res = await fetch(`/api/orders/${orderId}/files`, { method: "POST", body: fd });
      if (!res.ok) {
        const msg = await res.text();
        alert(`Uppladdning misslyckades: ${msg}`);
        return;
      }
      // ❗Ingen optimistisk setData här – låt Pusher-eventet uppdatera listan
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
    if (!confirm(`Är du säker på att du vill ta bort filen "${filename}"? Detta går inte att ångra.`)) return;
    const res = await fetch(`/api/orders/${orderId}/files/${fileId}`, { method: "DELETE" });
    if (!res.ok) {
      const msg = await res.text();
      alert(`Kunde inte ta bort filen: ${msg}`);
      return;
    }
setData(prev => (prev ? { ...prev, files: prev.files.filter(f => f.id !== fileId) } : prev));
  }

  async function setStatus(
    t: Track,
    status: "INKOMMANDE" | "PAGAENDE" | "LEVERANS" | "AVSLUTAD"
  ) {
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
  if (!data) return <div className="p-6">Laddar…</div>;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          Order #{data.orderNumber} – {data.title}
        </h1>
        <p className="text-gray-600">Kund: {data.customerName ?? "-"}</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {(["A","B"] as const).map((t) => {
          const trackRow = data.tracks.find((x) => x.track === t);
          const currentStatus = trackRow?.status as keyof typeof TRACK_STATUS_COLORS | undefined;
          return (
            <div key={t} className="border rounded p-3">
              <div className="font-semibold mb-2">{TRACK_LABELS[t]}</div>

              <div className="mb-2 flex items-center gap-2">
                Status:
                {currentStatus ? (
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-semibold border ${TRACK_STATUS_COLORS[currentStatus]}`}
                  >
                    {currentStatus}
                  </span>
                ) : (
                  <span className="font-medium">—</span>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {(["INKOMMANDE","PAGAENDE","LEVERANS","AVSLUTAD"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatus(t, s)}
                    className={`text-xs border px-2 py-1 rounded transition
                      ${TRACK_STATUS_COLORS[s] ?? "hover:bg-slate-100"}
                      ${s === currentStatus ? "ring-2 ring-black/10" : ""}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Uppladdning */}
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
            onClick={() => document.getElementById("fileInput")?.click()}
            className="px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700
                       focus:outline-none focus:ring-2 focus:ring-emerald-400 transition"
          >
            {file ? `Vald: ${file.name}` : "Välj fil"}
          </button>

          <select
            value={track}
            onChange={(e) => setTrack(e.target.value as TrackType)}
            className="border p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            <option value="SHARED">Delad</option>
            <option value="A">Ateljé</option>
            <option value="B">Verkstad</option>
          </select>

          <button
            type="submit"
            disabled={loading || !file}
            className="px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700
                       disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-emerald-400 transition"
          >
            {loading ? "Laddar…" : "Ladda upp"}
          </button>
        </div>
      </form>

      {/* Filer */}
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
              className="mt-2 text-xs rounded border px-2 py-1 bg-rose-50 border-rose-300 text-rose-800 hover:bg-rose-100"
            >
              Ta bort
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
