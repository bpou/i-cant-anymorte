import CompletedClient from "./CompletedClient";
// import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CompletedPage() {
  // (Valfritt) Server-side roll-kontroll
  // const session = await auth();
  // if (!session || !["ADMIN","SALJARE"].includes(session.user.role)) {
  //   redirect("/"); // eller returnera 403-sida
  // }

  return <CompletedClient /* role={session?.user.role} */ />;
}
