import CalendarClient from "../CalendarClient";
import { notFound } from "next/navigation";

export const revalidate = 0;

export default async function CalendarPage(
  { params }: { params: { track: string } }
) {
  const t = (params.track || "").toUpperCase();
  if (t !== "A" && t !== "B") notFound();
  return <CalendarClient track={t as "A" | "B"} />;
}
