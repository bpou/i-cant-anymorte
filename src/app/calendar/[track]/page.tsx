// src/app/calendar/[track]/page.tsx
import { notFound } from "next/navigation";
import CalendarClient from "../CalendarClient"; // justera sökvägen vid behov
import { normalizeTrack } from "@/lib/tracks";

export default async function CalendarPage({
  params,
}: {
  params: Promise<{ track: string }>;
}) {
  const { track } = await params;               // vänta in params
  const normalized = normalizeTrack(track);

  if (!normalized) notFound();

  return <CalendarClient track={normalized} />;
}