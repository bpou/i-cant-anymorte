// src/app/orders/new/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import NewOrderClient from "./NewOrderClient";

export default async function Page() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/login"); // ej inloggad
  }

  const role = (session.user as any)?.role;
  if (role !== "SALJARE" && role !== "ADMIN") {
    redirect("/403"); // saknar behörighet
  }

  return <NewOrderClient />;
}
