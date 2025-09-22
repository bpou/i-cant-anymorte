"use client";
import { useEffect, useState, useCallback } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";

export default function CalendarClient({ track }: { track: "A" | "B" }) {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/calendar?track=${track}`);
      const json = await res.json();
      setEvents(json.events ?? []);
    } finally {
      setLoading(false);
    }
  }, [track]);

  useEffect(() => { load(); }, [load]);

  const onEventDrop = async (info: any) => {
    const { id, start, end } = info.event;
    await fetch(`/api/calendar/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ start: start?.toISOString(), end: end?.toISOString() }),
    });
    load();
  };

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-2xl font-bold">Kalender – Spår {track}</h1>
        {loading && <span className="text-sm text-gray-500">Laddar…</span>}
      </div>
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="timeGridWeek"
        headerToolbar={{ left:"prev,next today", center:"title", right:"dayGridMonth,timeGridWeek,timeGridDay" }}
        events={events}
        height="80vh"
        nowIndicator
        editable
        eventDrop={onEventDrop}
        eventResize={onEventDrop}
      />
    </div>
  );
}

