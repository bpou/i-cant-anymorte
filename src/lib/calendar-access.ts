import { getServerSession } from "next-auth";
import type { Session } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Role, type Track } from "@prisma/client";
import { isAppTrack, TRACK_TEAM_ROLE } from "@/lib/tracks";

export async function getSessionAndRole(): Promise<{
  session: Session | null;
  role: Role | undefined;
}> {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role as Role | undefined;
  return { session, role };
}

export function canAccessCalendarTrack(
  role: Role | undefined,
  track: Track | null | undefined
): boolean {
  if (!role) return false;
  if (role === Role.ADMIN || role === Role.SALJARE) return true;
  if (!track) return false;

  if (track === "SHARED") {
    return (
      role === Role.A_TEAM ||
      role === Role.B_TEAM ||
      role === Role.C_TEAM ||
      role === Role.D_TEAM
    );
  }

  if (!isAppTrack(track)) return false;
  const required = TRACK_TEAM_ROLE[track];
  return !!required && role === required;
}
