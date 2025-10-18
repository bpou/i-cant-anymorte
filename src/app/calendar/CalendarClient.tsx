"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import type {
  CalendarApi,
  EventApi,
  EventContentArg,
  EventInput,
} from "@fullcalendar/core";
import { STATUS_COLOR_PARTS, STATUS_DISPLAY } from "@/lib/orderStatus";
import type { StatusColorParts } from "@/lib/orderStatus";
import CalendarSkin from "@/components/calendar/CalendarSkin";
import { OrdinaLogoSpinner } from "@/components/OrdinaLoader";
import svLocale from "@fullcalendar/core/locales/sv";
import { TRACK_CALENDAR_LABELS, type AppTrack } from "@/lib/tracks";
import { MapPin, ChevronLeft, ChevronRight } from "lucide-react";

/* =========================
   Util: safe JSON
========================= */
async function safeJson<T = any>(
  res: Response | undefined | null,
  fallback: T,
): Promise<T> {
  try {
    if (!res || !res.ok) return fallback;
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("application/json")) {
      const txt = await res.text().catch(() => "");
      if (!txt) return fallback;
      try {
        return JSON.parse(txt) as T;
      } catch {
        return fallback;
      }
    }
    return (await res.json()) as T;
  } catch {
    return fallback;
  }
}

/* =========================
   Types
========================= */
type CalendarClientProps = { track: AppTrack };
type CalendarEventResponse = { events?: EventInput[] };

type Status = "INKOMMANDE" | "PAGAENDE" | "LEVERANS" | "AVSLUTAD" | "PALACK";
type CalendarStatus = Extract<
  Status,
  "PAGAENDE" | "PALACK" | "LEVERANS" | "AVSLUTAD"
>;
type Visibility = "PUBLIC" | "PERSONAL";

type Label =
  | "BOKAD_TID"
  | "KAN_FLYTTAS"
  | "LUNCH"
  | "SEMESTER"
  | "TRAFIKVERKET"
  | "UNDER_VECKAN"
  | "UTFORT_ARBETE";

type Palette = StatusColorParts;
type CalendarView =
  | "timeGridWorkWeek"
  | "timeGridDay"
  | "timeGridWeek"
  | "dayGridWeek"
  | "dayGridMonth";

/* =========================
   Constants / helpers
========================= */
const CALENDAR_STATUS_ORDER: CalendarStatus[] = [
  "PAGAENDE",
  "PALACK",
  "LEVERANS",
  "AVSLUTAD",
];

const STATUS_BADGE: Record<CalendarStatus, string> = {
  PAGAENDE: `border ${STATUS_COLOR_PARTS.PAGAENDE.bgClass} ${STATUS_COLOR_PARTS.PAGAENDE.textClass} ${STATUS_COLOR_PARTS.PAGAENDE.borderClass}`,
  PALACK: `border ${STATUS_COLOR_PARTS.PALACK.bgClass} ${STATUS_COLOR_PARTS.PALACK.textClass} ${STATUS_COLOR_PARTS.PALACK.borderClass}`,
  AVSLUTAD: `border ${STATUS_COLOR_PARTS.AVSLUTAD.bgClass} ${STATUS_COLOR_PARTS.AVSLUTAD.textClass} ${STATUS_COLOR_PARTS.AVSLUTAD.borderClass}`,
  LEVERANS: `border ${STATUS_COLOR_PARTS.LEVERANS.bgClass} ${STATUS_COLOR_PARTS.LEVERANS.textClass} ${STATUS_COLOR_PARTS.LEVERANS.borderClass}`,
};
const STATUS_DOT: Record<CalendarStatus, string> = {
  PAGAENDE: STATUS_COLOR_PARTS.PAGAENDE.bgClass,
  PALACK: STATUS_COLOR_PARTS.PALACK.bgClass,
  AVSLUTAD: STATUS_COLOR_PARTS.AVSLUTAD.bgClass,
  LEVERANS: STATUS_COLOR_PARTS.LEVERANS.bgClass,
};

const LABEL_COLORS: Record<Label, Palette> = {
  BOKAD_TID: {
    bgClass: "bg-[#E74B56]",
    textClass: "text-white",
    borderClass: "border-[#C63B45]",
    bgHex: "#E74B56",
    textHex: "#FFFFFF",
    borderHex: "#C63B45",
  },
  KAN_FLYTTAS: {
    bgClass: "bg-[#0F6B2E]",
    textClass: "text-white",
    borderClass: "border-[#0A4D20]",
    bgHex: "#0F6B2E",
    textHex: "#FFFFFF",
    borderHex: "#0A4D20",
  },
  LUNCH: {
    bgClass: "bg-[#FFD91A]",
    textClass: "text-[#5B4700]",
    borderClass: "border-[#E0B600]",
    bgHex: "#FFD91A",
    textHex: "#5B4700",
    borderHex: "#E0B600",
  },
  SEMESTER: {
    bgClass: "bg-[#FF7A00]",
    textClass: "text-[#5B2C00]",
    borderClass: "border-[#E06600]",
    bgHex: "#FF7A00",
    textHex: "#5B2C00",
    borderHex: "#E06600",
  },
  TRAFIKVERKET: {
    bgClass: "bg-[#8E6CE0]",
    textClass: "text-white",
    borderClass: "border-[#704FC5]",
    bgHex: "#8E6CE0",
    textHex: "#FFFFFF",
    borderHex: "#704FC5",
  },
  UNDER_VECKAN: {
    bgClass: "bg-[#4CD964]",
    textClass: "text-[#0F3F16]",
    borderClass: "border-[#34B44C]",
    bgHex: "#4CD964",
    textHex: "#0F3F16",
    borderHex: "#34B44C",
  },
  UTFORT_ARBETE: {
    bgClass: "bg-[#B0BEC5]",
    textClass: "text-[#263238]",
    borderClass: "border-[#90A4AE]",
    bgHex: "#B0BEC5",
    textHex: "#263238",
    borderHex: "#90A4AE",
  },
};

const LABEL_TW = Object.fromEntries(
  Object.entries(LABEL_COLORS).map(([key, spec]) => [
    key,
    `border ${spec.bgClass} ${spec.textClass} ${spec.borderClass}`,
  ]),
) as Record<Label, string>;
const LABEL_DOT = Object.fromEntries(
  Object.entries(LABEL_COLORS).map(([key, spec]) => [key, spec.bgClass]),
) as Record<Label, string>;

const LABEL_ORDER: Label[] = [
  "BOKAD_TID",
  "KAN_FLYTTAS",
  "LUNCH",
  "SEMESTER",
  "TRAFIKVERKET",
  "UNDER_VECKAN",
  "UTFORT_ARBETE",
];

const DONE_PALETTE: Palette = {
  bgClass: "bg-gray-200",
  textClass: "text-gray-700",
  borderClass: "border-gray-300",
  bgHex: "#E5E7EB",
  textHex: "#374151",
  borderHex: "#D1D5DB",
};

const VIEW_OPTIONS: { key: CalendarView; label: string }[] = [
  { key: "timeGridDay", label: "Dag" },
  { key: "timeGridWorkWeek", label: "Arbetsvecka" },
  { key: "timeGridWeek", label: "Vecka" },
  { key: "dayGridMonth", label: "Månad" },
];

const isDone = (s?: Status, l?: Label) =>
  s === "AVSLUTAD" || l === "UTFORT_ARBETE";
const isIncoming = (s?: Status) => s === "INKOMMANDE";

function basePalette(
  status: Status | undefined,
  label: Label | undefined,
): Palette | undefined {
  if (isDone(status, label)) return DONE_PALETTE;
  if (isIncoming(status)) return label ? LABEL_COLORS[label] : undefined;
  if (
    status &&
    (status === "PAGAENDE" || status === "PALACK" || status === "LEVERANS")
  )
    return STATUS_COLOR_PARTS[status];
  if (label) return LABEL_COLORS[label];
  return undefined;
}

function isOrderEvent(e: EventApi | EventInput | undefined): boolean {
  if (!e) return false;
  const xp: any =
    ("extendedProps" in e ? (e as any).extendedProps : undefined) || {};
  return Boolean(xp.orderId || xp.status);
}

function applyPalette(el: HTMLElement, palette: Palette | undefined) {
  if (!palette) return;
  el.style.setProperty("background-color", palette.bgHex, "important");
  const textColor = palette.textHex ?? "#000000";
  el.style.setProperty("color", textColor, "important");
  el.style.setProperty("border-color", palette.borderHex, "important");
}

function adjustHex(hex: string | undefined, amount: number) {
  if (!hex) return undefined;
  let color = hex.replace("#", "");
  if (color.length === 3) {
    color = color
      .split("")
      .map((c) => c + c)
      .join("");
  }
  const num = parseInt(color, 16);
  if (Number.isNaN(num)) return hex;
  const clamp = (channel: number) =>
    Math.max(0, Math.min(255, channel + amount));
  const r = clamp(num >> 16);
  const g = clamp((num >> 8) & 0x00ff);
  const b = clamp(num & 0x0000ff);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

function labelNice(k: Label) {
  switch (k) {
    case "BOKAD_TID":
      return "Bokad tid";
    case "KAN_FLYTTAS":
      return "Kan flyttas";
    case "LUNCH":
      return "Lunch";
    case "SEMESTER":
      return "Semester";
    case "TRAFIKVERKET":
      return "Trafikverket";
    case "UNDER_VECKAN":
      return "Under veckan";
    case "UTFORT_ARBETE":
      return "Utfört arbete";
    default:
      return k;
  }
}

/** datetime-local helpers */
function toLocalInputValue(d?: string) {
  if (!d) return "";
  const dt = new Date(d);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}
function fromLocalInputValue(v: string) {
  return new Date(v).toISOString();
}

/* =========================
   Component
========================= */

export default function CalendarClient({ track }: CalendarClientProps) {
  const calendarApiRef = useRef<CalendarApi | null>(null);
  const [events, setEvents] = useState<EventInput[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [currentView, setCurrentView] =
    useState<CalendarView>("timeGridWorkWeek");
  const [toolbarTitle, setToolbarTitle] = useState<string>("");

  // Event context menu (right-click on event)
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  const [menuEventId, setMenuEventId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Background context menu (right-click on empty space)
  const calendarRootRef = useRef<HTMLDivElement | null>(null);
  const [bgMenuOpen, setBgMenuOpen] = useState(false);
  const [bgMenuPos, setBgMenuPos] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  const bgMenuRef = useRef<HTMLDivElement | null>(null);

  const getCalendarApi = useCallback(
    () => calendarApiRef.current,
    [],
  );
  const handleToday = useCallback(() => {
    getCalendarApi()?.today();
  }, [getCalendarApi]);
  const handlePrev = useCallback(() => {
    getCalendarApi()?.prev();
  }, [getCalendarApi]);
  const handleNext = useCallback(() => {
    getCalendarApi()?.next();
  }, [getCalendarApi]);
  const handleViewChange = useCallback(
    (view: CalendarView) => {
      const api = getCalendarApi();
      if (!api) return;
      api.changeView(view);
      setCurrentView(view);
      setToolbarTitle(api.view.title);
    },
    [getCalendarApi],
  );

  const handleCalendarRef = useCallback((fc: any) => {
    if (fc) {
      const api: CalendarApi = fc.getApi();
      calendarApiRef.current = api;
      setToolbarTitle(api.view.title);
      setCurrentView(api.view.type as CalendarView);
    } else {
      calendarApiRef.current = null;
    }
  }, []);

  // New free-form event modal
  const [modalOpen, setModalOpen] = useState(false);
  const [draft, setDraft] = useState({
    title: "",
    label: null as Label | null,
    allDay: false,
    start: "",
    end: "",
    repeat: "none" as "none" | "weekly" | "daily",
    weeklyDays: [] as string[],
    visibility: "PUBLIC" as Visibility,
  });
  function getEventMetaById(id: string, list: EventInput[]) {
    const ev = list.find((e) => String(e.id) === String(id)) as any;
    if (!ev)
      return {
        ev: null as any,
        kind: null as "free" | "order" | null,
        realId: null as string | null,
      };
    const kind =
      ev?.extendedProps?.kind ?? (ev?.extendedProps?.orderId ? "order" : null);
    const realId =
      kind === "free" ? (ev?.extendedProps?.realId ?? null) : String(id);
    return { ev, kind, realId };
  }

  /* ===== Load calendar events (orders + free) ===== */
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [orderRes, freeRes] = await Promise.all([
        fetch(`/api/calendar?track=${track}`, {
          cache: "no-store",
          headers: { Accept: "application/json" },
        }),
        fetch(`/api/free-events?track=${track}`, {
          cache: "no-store",
          headers: { Accept: "application/json" },
        }),
      ]);

      const orderJson = await safeJson<CalendarEventResponse>(orderRes, {
        events: [],
      });
      const freeJson = await safeJson<CalendarEventResponse>(freeRes, {
        events: [],
      });

      const orders = Array.isArray(orderJson.events) ? orderJson.events : [];
      const freeRaw = Array.isArray(freeJson.events) ? freeJson.events : [];

      const free = freeRaw.map((e: any) => ({
        ...e,
        id: `free-${e.id}`,
        extendedProps: {
          ...(e.extendedProps || {}),
          kind: "free",
          realId: e.id,
          visibility: e.visibility ?? "PUBLIC",
        },
      }));

      setEvents([...orders, ...free]);
    } catch (e) {
      console.error(e);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [track]);

  useEffect(() => {
    void load();
  }, [load]);

  /* ===== Create free event ===== */
  const handleSaveFreeEvent = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    setSaveError(null);

    const visibility: Visibility =
      draft.visibility === "PERSONAL" ? "PERSONAL" : "PUBLIC";
    const startISO = draft.start ? new Date(draft.start).toISOString() : new Date().toISOString();
    const endISO = draft.end ? new Date(draft.end).toISOString() : new Date(Date.now() + 60 * 60 * 1000).toISOString();

    const toHHMMSS = (iso: string | undefined, fallback: string) => {
      if (!iso) return fallback;
      const m = iso.match(/T(\d{2}:\d{2}:\d{2})/);
      return m ? m[1] : fallback;
    };

    const payload: any = {
      track,
      title: draft.title || (draft.label ? labelNice(draft.label) : "Event"),
      label: draft.label,
      visibility,
    };

    if (draft.repeat === "weekly") {
      payload.repeat = "weekly";
      payload.weeklyDays = draft.weeklyDays.length ? draft.weeklyDays : ["1"];
      payload.startRecur = (draft.start ? new Date(draft.start) : new Date()).toISOString();
      payload.endRecur = null;
      payload.startTime = toHHMMSS(draft.start, "12:00:00");
      payload.endTime = toHHMMSS(draft.end, "13:00:00");
    } else if (draft.repeat === "daily") {
      payload.repeat = "daily";
      payload.weeklyDays = ["0", "1", "2", "3", "4", "5", "6"];
      payload.startRecur = (draft.start ? new Date(draft.start) : new Date()).toISOString();
      payload.endRecur = null;
      payload.startTime = toHHMMSS(draft.start, "12:00:00");
      payload.endTime = toHHMMSS(draft.end, "13:00:00");
    } else {
      payload.repeat = "none";
      payload.start = startISO;
      payload.end = endISO;
    }

    try {
      const res = await fetch("/api/free-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const msg = await res.text().catch(() => "Failed to create event");
        setSaveError(msg);
        setSaving(false);
        return;
      }

      setModalOpen(false);
      await load();
    } catch (err: any) {
      setSaveError(err?.message ?? "Unexpected error");
    } finally {
      setSaving(false);
    }
  }, [saving, track, draft, load]);

  /* ===== Helpers only used inside component ===== */
  const getEventById = useCallback(
    (id: string | null) =>
      events.find((e) => String(e.id) === String(id)) ?? null,
    [events],
  );

  const isDeletableEvent = useCallback((ev: EventInput | null) => {
    if (!ev) return false;
    const kind = (ev as any)?.extendedProps?.kind;
    // only free events are deletable here
    return kind === "free";
  }, []);

  const deleteEventById = useCallback(
    async (eventId: string) => {
      const ev = getEventById(eventId);
      const kind = (ev as any)?.extendedProps?.kind;

      if (kind !== "free") {
        setActionError("Endast fria händelser kan tas bort.");
        setMenuOpen(false);
        setMenuEventId(null);
        return;
      }

      const realId = (ev as any)?.extendedProps?.realId ?? eventId;
      const url = `/api/free-events/${encodeURIComponent(realId)}`;

      // optimistic removal
      setEvents((prev) => prev.filter((e) => String(e.id) !== String(eventId)));

      try {
        const res = await fetch(url, { method: "DELETE" });
        if (!res.ok) {
          const msg = await res.text().catch(() => "Failed to delete event");
          setActionError(msg || "Failed to delete event");
          await load(); // restore from server
          return;
        }
        await load();
      } catch (err: any) {
        setActionError(err?.message ?? "Failed to delete event");
        await load();
      } finally {
        setMenuOpen(false);
        setMenuEventId(null);
      }
    },
    [getEventById, load],
  );

  /* ===== Event context menu close on outside click / ESC ===== */
  const closeEventMenu = useCallback(() => {
    setMenuOpen(false);
    setMenuEventId(null);
  }, []);
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!menuOpen) return;
      if (menuRef.current && !menuRef.current.contains(e.target as Node))
        closeEventMenu();
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeEventMenu();
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [menuOpen, closeEventMenu]);

  /* ===== Background context menu (right-click on empty space) ===== */
  useEffect(() => {
    const root = calendarRootRef.current;
    if (!root) return;
    const onCtx = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest(".fc-event")) return; // ignore right-clicks on events
      e.preventDefault();
      setBgMenuPos({ x: e.clientX, y: e.clientY });
      setBgMenuOpen(true);
    };
    root.addEventListener("contextmenu", onCtx);
    return () => root.removeEventListener("contextmenu", onCtx);
  }, []);

  useEffect(() => {
    if (!bgMenuOpen) return;
    const onKey = (e: KeyboardEvent) =>
      e.key === "Escape" && setBgMenuOpen(false);
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (bgMenuRef.current && !bgMenuRef.current.contains(t))
        setBgMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDoc);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDoc);
    };
  }, [bgMenuOpen]);

  /* ===== Persisters ===== */
  const setEventStatus = useCallback(
    async (eventId: string, next: CalendarStatus) => {
      // optimistic
      setEvents((prev) =>
        prev.map((e) =>
          String(e.id) === String(eventId)
            ? {
                ...e,
                extendedProps: {
                  ...(e.extendedProps || {}),
                  status: next,
                  label: null,
                },
              }
            : e,
        ),
      );
      try {
        const res = await fetch(
          `/api/calendar/${encodeURIComponent(eventId)}/status`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: next, track }),
          },
        );
        if (!res.ok) throw new Error(await res.text());
        await load();
      } catch (err) {
        console.error("Failed to set status", err);
        await load();
      } finally {
        closeEventMenu();
      }
    },
    [track, load, closeEventMenu],
  );

  const setCalendarLabel = useCallback(
    async (eventId: string, label: Label | null) => {
      // optimistic
      setEvents((prev) =>
        prev.map((e) =>
          String(e.id) === String(eventId)
            ? {
                ...e,
                extendedProps: {
                  ...(e.extendedProps || {}),
                  label,
                  ...(label === "UTFORT_ARBETE" ? { status: "AVSLUTAD" } : {}),
                },
              }
            : e,
        ),
      );
      try {
        if (label === "UTFORT_ARBETE") {
          const sRes = await fetch(
            `/api/calendar/${encodeURIComponent(eventId)}/status`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: "AVSLUTAD", track }),
            },
          );
          if (!sRes.ok) throw new Error(await resTextSafe(sRes));

          const lRes = await fetch(
            `/api/calendar/${encodeURIComponent(eventId)}/label`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ label: null, track }),
            },
          );
          if (!lRes.ok) throw new Error(await resTextSafe(lRes));
        } else {
          const res = await fetch(
            `/api/calendar/${encodeURIComponent(eventId)}/label`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ label, track }),
            },
          );
          if (!res.ok) throw new Error(await resTextSafe(res));
        }
        await load();
      } catch (err) {
        console.error("Failed to set calendar label", err);
        await load();
      } finally {
        closeEventMenu();
      }
    },
    [track, load, closeEventMenu],
  );

  async function resTextSafe(r: Response) {
    try {
      return await r.text();
    } catch {
      return "Request failed";
    }
  }

  /* ===== Renderers ===== */
  const renderEventContent = useCallback((arg: EventContentArg) => {
    const xp: any = arg.event.extendedProps ?? {};
    const location = (xp.location as string | null) ?? null;
    const label = xp.label as Label | undefined;
    const synthetic = Boolean(xp.synthetic);
    const orderId = (xp.orderId as string | null) ?? (arg.event.id as string);
    const orderTitle =
      (xp.orderTitle as string | null) ?? arg.event.title ?? "";
    const sellerInitials = (xp.sellerInitials as string | null) ?? null;
    const timeText = arg.timeText;

    return (
      <div className="ordina-calendar-event-inner flex h-full flex-col gap-2 rounded-xl px-3 py-2 text-[11px] leading-tight">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-0.5">
            <div className="text-xs font-semibold tracking-tight uppercase">
              {orderId}
            </div>
            <div className="text-[11px] font-medium leading-tight break-words">
              {orderTitle}
            </div>
          </div>
          {sellerInitials ? (
            <span className="text-[11px] font-semibold opacity-80">
              /{sellerInitials}
            </span>
          ) : null}
        </div>

        {location ? (
          <div className="flex items-start gap-1 text-[10px] opacity-90">
            <MapPin
              className="mt-[2px] h-3 w-3 shrink-0"
              strokeWidth={2.5}
              aria-hidden
            />
            <span className="min-w-0 flex-1 break-words">
              {location}
            </span>
          </div>
        ) : null}

        <div className="mt-auto flex items-center justify-between gap-2 text-[10px]">
          {timeText ? (
            <span className="font-semibold tracking-tight">{timeText}</span>
          ) : (
            <span />
          )}
          {label ? (
            <span className="rounded-full bg-white/40 px-2 py-0.5 font-semibold">
              {labelNice(label)}
            </span>
          ) : null}
        </div>

        {synthetic ? (
          <span className="text-[10px] font-semibold text-amber-900">
            Planerat (utan kalenderpost)
          </span>
        ) : null}
      </div>
    );
  }, []);

  const eventClassNames = useCallback((arg: any) => {
    const classes: string[] = [
      "rounded-2xl",
      "border",
      "border-transparent",
      "shadow-sm",
      "px-0",
      "py-0",
      "overflow-hidden",
      "relative",
      "flex",
      "flex-col",
      "ordina-calendar-event",
    ];
    if (arg.event.extendedProps?.synthetic) {
      classes.push("border-dashed");
    } else {
      classes.push("ordina-calendar-event--interactive");
    }
    return classes;
  }, []);

  const eventDidMount = useCallback(
    (arg: { el: HTMLElement; event: EventApi }) => {
      const status = arg.event.extendedProps?.status as Status | undefined;
      const label = arg.event.extendedProps?.label as Label | undefined;
      const palette = basePalette(status, label);

      applyPalette(arg.el, palette);
      if (arg.event.extendedProps?.synthetic) arg.el.style.opacity = "0.9";

      arg.el.style.padding = "0";
      arg.el.style.display = "flex";
      arg.el.style.flexDirection = "column";

      const accent = adjustHex(palette?.bgHex, -35) ?? "rgba(0,0,0,0.2)";
      arg.el.style.setProperty("--ordina-accent", accent);
      arg.el.style.setProperty("--ordina-accent-width", "12px");
      arg.el.style.setProperty(
        "--ordina-divider",
        adjustHex(palette?.bgHex, -20) ?? "rgba(0,0,0,0.25)",
      );
      arg.el.style.backgroundImage = "none";
      arg.el.style.backgroundBlendMode = "normal";
      arg.el.style.backgroundRepeat = "no-repeat";

      const handler = (ev: MouseEvent) => {
        // Open menu for any event (orders or free)
        ev.preventDefault();
        setMenuEventId(arg.event.id);
        setMenuPos({ x: ev.clientX, y: ev.clientY });
        setMenuOpen(true);
      };
      arg.el.addEventListener("contextmenu", handler);
      return () => arg.el.removeEventListener("contextmenu", handler);
    },
    [],
  );

  const allowEventMutation = useCallback(
    (_dropInfo: any, draggedEvent: any) => {
      return !draggedEvent.extendedProps?.synthetic;
    },
    [],
  );

  const onEventDrop = useCallback(
    async (info: any) => {
      const ev = info.event;

      const isFree = ev.extendedProps?.kind === "free";
      const realId = isFree ? ev.extendedProps?.realId : ev.id;
      const url = isFree
        ? `/api/free-events/${encodeURIComponent(realId)}`
        : `/api/calendar/${encodeURIComponent(realId)}`;

      const startISO = ev.start ? ev.start.toISOString() : undefined;
      const endISO = ev.end ? ev.end.toISOString() : undefined;

      const payload: any = isFree
        ? { start: startISO, end: endISO }
        : { start: startISO, end: endISO, track };

      try {
        const res = await fetch(url, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          console.error(`[calendar] PATCH ${url} failed (${res.status}):`, text || res.statusText);
          info.revert();
          return;
        }

        await load();
      } catch (err) {
        console.error("[calendar] PATCH error:", err);
        info.revert();
      }
    },
    [load, track],
  );

  /* =========================
     Render
  ========================= */
  const menuEvent = getEventById(menuEventId);
  const menuIsOrder = isOrderEvent(menuEvent as any);
  const menuCanDelete = isDeletableEvent(menuEvent);

  return (
    <div className="bg-[radial-gradient(circle_at_top,_rgba(28,155,241,0.08),_transparent_55%)]">
      <div className="relative mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6">
          <section className="relative overflow-hidden rounded-3xl border border-brand-200 bg-white/95 px-6 py-6 shadow-[0_24px_70px_-48px_rgba(15,23,42,0.5)]">
            <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(28,155,241,0.12),_transparent_70%)]" />
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handlePrev}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-brand-200 bg-white text-brand-600 shadow-[0_18px_30px_-24px_rgba(15,23,42,0.45)] transition hover:border-brand-300 hover:bg-brand-50/80 hover:text-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-300"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  <span className="sr-only">Föregående period</span>
                </button>
                <div className="rounded-full border border-brand-200 bg-white/90 px-4 py-1.5 text-sm font-semibold text-neutral-900 shadow-[0_20px_45px_-32px_rgba(15,23,42,0.5)]">
                  {toolbarTitle || "Kalender"}
                </div>
                <button
                  type="button"
                  onClick={handleNext}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-brand-200 bg-white text-brand-600 shadow-[0_18px_30px_-24px_rgba(15,23,42,0.45)] transition hover:border-brand-300 hover:bg-brand-50/80 hover:text-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-300"
                >
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  <span className="sr-only">Nästa period</span>
                </button>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.26em] text-brand-600">
                {TRACK_CALENDAR_LABELS[track]}
              </span>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleToday}
                className="rounded-full border border-brand-200 bg-white px-4 py-1.5 text-sm font-semibold text-brand-700 shadow-[0_18px_35px_-28px_rgba(15,23,42,0.4)] transition hover:border-brand-300 hover:bg-brand-50/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-300"
              >
                I dag
              </button>
              <div className="flex overflow-hidden rounded-full border border-brand-200 bg-white shadow-[0_18px_40px_-32px_rgba(15,23,42,0.45)]">
                {VIEW_OPTIONS.map((opt) => {
                  const active = currentView === opt.key;
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => handleViewChange(opt.key)}
                      className={`px-3 py-1.5 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-300 ${
                        active
                          ? "bg-brand-500 text-white shadow-inner"
                          : "text-neutral-700 hover:bg-brand-50/80 hover:text-brand-700"
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              <div className="ml-auto flex items-center gap-2 text-sm text-neutral-500">
                {loading && (
                  <div className="flex items-center gap-2">
                    <OrdinaLogoSpinner size={20} />
                    <span>Laddar</span>
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="relative overflow-hidden rounded-3xl border border-brand-200 bg-white/95 shadow-[0_24px_70px_-48px_rgba(15,23,42,0.5)]">
            <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(28,155,241,0.08),_transparent_80%)]" />
            <div className="relative p-3 sm:p-5">
              <CalendarSkin framed={false}>
                <div
                  ref={calendarRootRef}
                  className="h-[calc(100vh-260px)] min-h-[600px]"
                >
                  <FullCalendar
                    ref={handleCalendarRef}
                    plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                    locales={[svLocale]}
                    locale="sv"
                    initialView="timeGridWorkWeek"
                    headerToolbar={false}
                    allDaySlot={false}
                    views={{
                      timeGridWorkWeek: { type: "timeGridWeek", weekends: false },
                      timeGridWeek: { type: "timeGridWeek", weekends: true },
                    }}
                    titleFormat={{ month: "long", year: "numeric" }}
                    dayHeaderContent={(args) => {
                      const date = args.date;
                      const weekday = date.toLocaleDateString("sv-SE", {
                        weekday: "short",
                      });
                      return (
                        <div className="flex w-full flex-col items-start gap-0.5 py-1 pl-2 text-left">
                          <span className="text-2xl font-semibold ">
                            {date.getDate()}
                          </span>
                          <span className="text-xs uppercase tracking-wide text-neutral-500">
                            {weekday}
                          </span>
                        </div>
                      );
                    }}
                    slotDuration="01:00:00"
                    snapDuration="00:30:00"
                    slotLabelFormat={{
                      hour: "numeric",

                      hour12: false,
                    }}
                    eventTimeFormat={{
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: false,
                    }}
                    scrollTime="07:00:00"
                    scrollTimeReset={false}
                    slotMinTime="00:00:00"
                    slotMaxTime="24:00:00"
                    stickyHeaderDates
                    selectable
                    selectMirror
                    select={(arg) => {
                      setDraft((d) => ({
                        ...d,
                        start: arg.start ? arg.start.toISOString() : "",
                        end: arg.end ? arg.end.toISOString() : "",
                      }));
                      setModalOpen(true);
                    }}
                    events={events}
                    height="100%"
                    contentHeight="100%"
                    nowIndicator
                    expandRows
                    editable
                    datesSet={(arg) => {
                      setToolbarTitle(arg.view.title);
                      setCurrentView(arg.view.type as CalendarView);
                    }}
                    eventDrop={onEventDrop}
                    eventResize={onEventDrop}
                    eventContent={renderEventContent}
                    eventClassNames={eventClassNames}
                    eventAllow={allowEventMutation}
                    eventDidMount={eventDidMount}
                  />
                </div>
              </CalendarSkin>
            </div>
          </section>
        </div>

        {/* Background right-click menu */}
        {bgMenuOpen && (
          <div
            ref={bgMenuRef}
            className="absolute z-50 min-w-[240px] overflow-hidden rounded-xl border border-brand-200 bg-white/98 shadow-[0_24px_60px_-36px_rgba(15,23,42,0.45)] backdrop-blur-sm"
            style={{ left: bgMenuPos.x, top: bgMenuPos.y }}
            role="menu"
          >
            <div className="border-b border-brand-100 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-brand-500">
              Ny kalenderhändelse
            </div>
            <button
              className="w-full px-3 py-2 text-left text-sm font-medium text-neutral-700 transition hover:bg-brand-50/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-300"
              onClick={() => {
                const now = new Date();
                const start = new Date(
                  now.getFullYear(),
                  now.getMonth(),
                  now.getDate(),
                  12,
                  0,
                  0,
                );
                const end = new Date(
                  now.getFullYear(),
                  now.getMonth(),
                  now.getDate(),
                  13,
                  0,
                  0,
                );
                setDraft({
                  title: "",
                  label: null,
                  allDay: false,
                  start: start.toISOString(),
                  end: end.toISOString(),
                  repeat: "none",
                  weeklyDays: [],
                  visibility: "PUBLIC",
                });
                setBgMenuOpen(false);
                setModalOpen(true);
              }}
            >
              Ny händelse
            </button>
          </div>
        )}

        {/* Event right-click menu */}
        {menuOpen && (
          <div
            ref={menuRef}
            className="absolute z-50 min-w-[220px] overflow-hidden rounded-xl border border-brand-200 bg-white/98 shadow-[0_24px_60px_-36px_rgba(15,23,42,0.45)] backdrop-blur-sm"
            style={{ left: menuPos.x, top: menuPos.y }}
            role="menu"
          >
            {menuIsOrder && (
              <>
                <div className="border-b border-brand-100 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-brand-500">
                  Sätt status
                </div>
                {CALENDAR_STATUS_ORDER.map((s) => (
                  <button
                    key={s}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-neutral-700 transition hover:bg-brand-50/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-300"
                    onClick={() => menuEventId && setEventStatus(menuEventId, s)}
                    role="menuitem"
                  >
                    <span
                      className={`inline-block h-2.5 w-2.5 rounded-full ${STATUS_DOT[s]}`}
                    />
                    <span className="font-medium">{STATUS_DISPLAY[s]}</span>
                  </button>
                ))}

                <div className="border-y border-brand-100 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-brand-500">
                  Kalenderetikett
                </div>
                {LABEL_ORDER.map((k) => (
                  <button
                    key={k}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-neutral-700 transition hover:bg-brand-50/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-300"
                    onClick={() =>
                      menuEventId && setCalendarLabel(menuEventId, k)
                    }
                    role="menuitem"
                  >
                    <span
                      className={`inline-block h-2.5 w-2.5 rounded-full ${LABEL_DOT[k]}`}
                    />
                    <span className="font-medium">{labelNice(k)}</span>
                  </button>
                ))}
                <div className="border-t border-brand-100">
                  <button
                    className="w-full px-3 py-2 text-left text-sm font-medium text-neutral-600 transition hover:bg-brand-50/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-300"
                    onClick={() =>
                      menuEventId && setCalendarLabel(menuEventId, null)
                    }
                  >
                    Rensa etikett
                  </button>
                </div>
              </>
            )}

            {/* Delete for any deletable event (free only) */}
            <div className="border-t border-brand-100">
              <button
                className={
                  "w-full px-3 py-2 text-left text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 " +
                  (menuCanDelete
                    ? "text-red-600 hover:bg-red-50 focus-visible:outline-red-200"
                    : "cursor-not-allowed text-neutral-400 focus-visible:outline-neutral-300")
                }
                disabled={!menuCanDelete}
                onClick={() => {
                  if (!menuEventId || !menuCanDelete) return;
                  deleteEventById(menuEventId);
                }}
              >
                Ta bort händelse
              </button>
            </div>

            <div className="border-t border-brand-100">
              <button
                className="w-full px-3 py-2 text-left text-sm font-medium text-neutral-600 transition hover:bg-brand-50/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-300"
                onClick={closeEventMenu}
              >
                Stäng
              </button>
            </div>
          </div>
        )}

      {/* New free-form event modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-lg rounded-3xl border border-brand-200 bg-white/98 shadow-[0_24px_70px_-48px_rgba(15,23,42,0.5)] backdrop-blur-sm">
            <div className="border-b border-brand-100 px-6 py-5">
              <h3 className="text-lg font-semibold text-neutral-900">Ny händelse</h3>
            </div>

            <div className="space-y-4 px-6 py-5">
              <div>
                <label className="text-sm font-semibold text-neutral-700">Titel</label>
                <input
                  className="mt-1 w-full rounded-xl border border-brand-200 bg-white px-3 py-2 text-sm text-neutral-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] transition focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                  value={draft.title}
                  onChange={(e) =>
                    setDraft({ ...draft, title: e.target.value })
                  }
                  placeholder="Lunch, Semester, etc."
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-neutral-700">Synlighet</label>
                <div className="mt-2 inline-flex rounded-full border border-brand-200 bg-white/95 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]">
                  {(["PUBLIC", "PERSONAL"] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setDraft({ ...draft, visibility: v })}
                      className={`rounded-full px-3 py-1.5 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-300 ${
                        draft.visibility === v
                          ? "bg-brand-600 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.24)]"
                          : "text-neutral-600 hover:bg-brand-50/80"
                      }`}
                    >
                      {v === "PUBLIC" ? "Public" : "Personal"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-semibold text-neutral-700">Start</label>
                  <input
                    type="datetime-local"
                    className="mt-1 w-full rounded-xl border border-brand-200 bg-white px-3 py-2 text-sm text-neutral-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] transition focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:opacity-60"
                    value={toLocalInputValue(draft.start)}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        start: fromLocalInputValue(e.target.value),
                      })
                    }
                    disabled={draft.repeat !== "none"}
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-neutral-700">Slut</label>
                  <input
                    type="datetime-local"
                    className="mt-1 w-full rounded-xl border border-brand-200 bg-white px-3 py-2 text-sm text-neutral-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] transition focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:opacity-60"
                    value={toLocalInputValue(draft.end)}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        end: fromLocalInputValue(e.target.value),
                      })
                    }
                    disabled={draft.repeat !== "none"}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-semibold text-neutral-700">Typ</label>
                  <select
                    className="mt-1 w-full rounded-xl border border-brand-200 bg-white px-3 py-2 text-sm text-neutral-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] transition focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                    value={draft.label ?? ""}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        label: (e.target.value || null) as Label | null,
                      })
                    }
                  >
                    <option value="">Ingen</option>
                    {LABEL_ORDER.map((l) => (
                      <option key={l} value={l}>
                        {labelNice(l)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-neutral-700">Upprepa</label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {["none", "daily", "weekly"].map((v) => (
                    <button
                      key={v}
                      onClick={() => setDraft({ ...draft, repeat: v as any })}
                      className={`rounded-full border px-3 py-1.5 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-300 ${
                        draft.repeat === v
                          ? "border-brand-500 bg-brand-500 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]"
                          : "border-brand-200 text-neutral-600 hover:bg-brand-50/80"
                      }`}
                      type="button"
                    >
                      {v === "none"
                        ? "Aldrig"
                        : v === "daily"
                        ? "Dagligen"
                        : "Veckovis"}
                    </button>
                  ))}
                </div>

                {draft.repeat === "weekly" && (
                  <div className="mt-3 grid grid-cols-7 gap-1 text-center">
                    {[
                      ["1", "M"],
                      ["2", "T"],
                      ["3", "O"],
                      ["4", "T"],
                      ["5", "F"],
                      ["6", "L"],
                      ["0", "S"],
                    ].map(([val, label]) => {
                      const active = draft.weeklyDays.includes(val);
                      return (
                        <button
                          key={val}
                          onClick={() => {
                            const set = new Set(draft.weeklyDays);
                            if (set.has(val)) set.delete(val);
                            else set.add(val);
                            setDraft({ ...draft, weeklyDays: Array.from(set) });
                          }}
                          className={`rounded-lg border px-2 py-1 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-300 ${
                            active
                              ? "border-brand-500 bg-brand-500 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]"
                              : "border-brand-200 text-neutral-600 hover:bg-brand-50/80"
                          }`}
                          type="button"
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 border-t border-brand-100 px-6 py-5">
              {saveError && (
                <div className="mr-auto text-sm font-medium text-red-600" aria-live="polite">
                  {saveError}
                </div>
              )}
              <button
                className="ml-auto rounded-full border border-brand-200 bg-white px-4 py-2 text-sm font-medium text-neutral-600 transition hover:border-brand-300 hover:bg-brand-50/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-300"
                onClick={() => setModalOpen(false)}
                type="button"
              >
                Avbryt
              </button>
              <button
                className="rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-[0_18px_40px_-28px_rgba(15,23,42,0.45)] transition hover:bg-brand-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-300 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-brand-600"
                onClick={handleSaveFreeEvent}
                disabled={saving}
                type="button"
              >
                {saving ? "Sparar..." : "Spara"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Action error toast-ish */}
      {actionError && (
        <div className="fixed bottom-4 right-4 rounded-lg bg-red-600 px-4 py-2 text-white shadow">
          {actionError}
        </div>
      )}
    </div>
  </div>
  );
}


















