import "./globals.css";
import Image from "next/image";
import Link from "next/link";           // 👈 Lägg till
import MobileMenu from "@/components/MobileMenu";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import UserMenu from "@/components/UserMenu";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);

  return (
    <html lang="sv">
      <body>
        <div className="min-h-dvh grid grid-cols-1">
          <main className="bg-slate-50">
            {/* ===== HEADER ===== */}
            <header className="bg-white border-b border-slate-200">
              {/* Desktop-version */}
              <div className="hidden sm:flex h-18 items-center justify-between px-6">
                {/* Vänster: hamburgare + logga */}
                <div className="flex items-center gap-0.5">
                  <MobileMenu />
                  <Link href="/">                               {/* 👈 Klickbar logga */}
                    <Image src="/logo.png" alt="Ordina" width={175} height={30} />
                  </Link>
                </div>

                {/* Höger: inloggad profil eller Logga in-knapp */}
                <UserMenu
                  isLoggedIn={!!session}
                  name={session?.user?.name ?? ""}
                  email={session?.user?.email ?? ""}
                  image={session?.user?.image ?? "/uploads/profiles/default-avatar.png"}
                />
              </div>

              {/* Mobil-version */}
              <div className="flex sm:hidden h-16 items-center justify-center px-4">
                {/* Mindre logga i mitten */}
                <Link href="/">                                {/* 👈 Klickbar logga */}
                  <Image
                    src="/logo.png"
                    alt="Ordina"
                    width={120}
                    height={24}
                    priority
                    className="object-contain"
                  />
                </Link>
              </div>
            </header>

            {/* ===== CONTENT ===== */}
            <div className="p-6">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
