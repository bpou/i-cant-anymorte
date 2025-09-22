import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import OrderTrackClient from "./OrderTrackClient";

type Role = "ADMIN" | "SALJARE" | "A_TEAM" | "B_TEAM";

export default async function Page({
  params,
}: { params: { id: string; track: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const role = (session.user as any)?.role as Role | undefined;
  const track = (params.track || "").toUpperCase();
  if (track !== "A" && track !== "B") notFound();

  const isAdminOrSales = role === "ADMIN" || role === "SALJARE";
  const allowed =
    isAdminOrSales ||
    (role === "A_TEAM" && track === "A") ||
    (role === "B_TEAM" && track === "B");

  if (!allowed) redirect("/403");

  return <OrderTrackClient id={params.id} track={track as "A" | "B"} />;
}
