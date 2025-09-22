import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import TrackBoardClient from "./TrackBoardClient";

type Role = "ADMIN" | "SALJARE" | "A_TEAM" | "B_TEAM";

export default async function Page({ params }: { params: { track: string } }) {
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

  return <TrackBoardClient track={track as "A" | "B"} />;
}
