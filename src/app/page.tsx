// src/app/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import HomeClient from "./HomeClient";

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role as "ADMIN"|"SALJARE"|"A_TEAM"|"B_TEAM"|undefined;

  // Ej inloggad – visa enkel hero
  if (!session) {
    return (
      <div className="min-h-[70vh] grid place-items-center p-6">
        <div className="max-w-lg text-center">
          <h1 className="text-2xl font-semibold">Välkommen till Ordina</h1>
          <p className="mt-2 text-neutral-600">Logga in för att skapa och följa upp ordrar.</p>
          <a
            href="/login"
            className="mt-6 inline-flex rounded-xl bg-brand-600 px-4 py-2 text-white hover:bg-brand-700"
          >
            Logga in
          </a>
        </div>
      </div>
    );
  }

  return (
    <HomeClient
      name={session.user?.name ?? "Användare"}
      role={role ?? "SALJARE"}
    />
  );
}
