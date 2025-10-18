import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import OrderTrackClient from "./OrderTrackClient";
import {
  STATUS_COLORS,
  STATUS_DISPLAY,
  ALL_STATUSES,
  type TrackStatus
} from "@/lib/orderStatus";
import { normalizeTrack, TRACK_TEAM_ROLE } from "@/lib/tracks";

type Role = "ADMIN" | "SALJARE" | "A_TEAM" | "B_TEAM" | "C_TEAM" | "D_TEAM";

export default async function Page({
  params,
}: { params: { id: string; track: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const role = (session.user as any)?.role as Role | undefined;
  const track = normalizeTrack(params.track);
  if (!track) notFound();

  const isAdminOrSales = role === "ADMIN" || role === "SALJARE";
  const requiredRole = TRACK_TEAM_ROLE[track];
  const allowed = isAdminOrSales || (!!requiredRole && role === requiredRole);

  if (!allowed) redirect("/403");

  return <OrderTrackClient id={params.id} track={track} />;
}