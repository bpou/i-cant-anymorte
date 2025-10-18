import "./globals.css";
import Image from "next/image";
import Link from "next/link";
import MobileMenu from "@/components/MobileMenu";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import UserMenu from "@/components/UserMenu";
import Footer from "@/components/Footer";
import { AlertTriangle } from "lucide-react";
import { AppSessionProvider } from "@/components/AppSessionProvider";

export const metadata = {
  title: "Ordina",
  description:
    "Ordina – smidigt orderhanteringssystem för hantverkare som vill följa jobb från offert till faktura.",
  icons: { icon: "/favicon.svg" },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  const needsMfa =
    Boolean(session?.user) && !Boolean((session?.user as any)?.mfaEnabled);

  return (
    <html lang="sv">
      <body className="bg-neutral-50 text-foreground antialiased" suppressHydrationWarning>
        <AppSessionProvider session={session}>
          <div id="top" className="min-h-dvh flex flex-col">
          {/* ===== MAIN ===== */}
          <main className="flex-1 bg-neutral-50">
            {/* ===== HEADER ===== */}
            <header
              className={[
                "sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur",
                "supports-[backdrop-filter]:bg-card/70",
                "pt-[env(safe-area-inset-top)]",
              ].join(" ")}
            >
              {/* Desktop-version */}
              <div className="hidden h-18 items-center justify-between px-6 sm:flex">
                {/* Left: hamburger + visually hidden logo */}
                <div className="flex items-center gap-2">
                  <MobileMenu />
                  <Link
                    href="/"
                    className="pointer-events-none select-none opacity-0"
                    aria-hidden="true"
                    tabIndex={-1}
                  >
                    <Image
                      src="/logo.png"
                      alt="Ordina"
                      width={175}
                      height={30}
                      className="object-contain"
                      aria-hidden
                    />
                  </Link>
                </div>

                {/* Right: user menu (authenticator warning removed) */}
                <div className="flex items-center gap-3">
                  <UserMenu
                    isLoggedIn={!!session}
                    name={session?.user?.name ?? ""}
                    email={session?.user?.email ?? ""}
                    image={session?.user?.image ?? "/uploads/profiles/default-avatar.png"}
                  />
                </div>
              </div>

              {/* Mobile-version */}
              <div className="flex h-16 items-center justify-between px-3 sm:hidden">
                {/* Left: hamburger */}
                <div className="-ml-1">
                  <MobileMenu />
                </div>

                {/* Center: visually hidden logo to preserve layout */}
                <Link
                  href="/"
                  className="shrink-0 opacity-0"
                  aria-hidden="true"
                  tabIndex={-1}
                >
                  <Image
                    src="/logo.png"
                    alt="Ordina"
                    width={124}
                    height={26}
                    priority
                    className="object-contain"
                    aria-hidden
                  />
                </Link>

                {/* Right: user avatar (authenticator warning removed) */}
                <div className="flex items-center gap-2">
                  <UserMenu
                    isLoggedIn={!!session}
                    name={session?.user?.name ?? ""}
                    email={session?.user?.email ?? ""}
                    image={session?.user?.image ?? "/uploads/profiles/default-avatar.png"}
                  />
                </div>
              </div>

              {/* Keep the extra MFA part with icon + text + Start button */}
              {needsMfa ? (
                <div className="sm:hidden border-t border-amber-200 bg-amber-50/95 px-3 py-2.5 text-amber-800">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                    <div className="flex-1 text-xs">
                      <p className="font-medium">Aktivera authenticator</p>
                      <p className="text-amber-800/80">Skydda ditt konto med engångskoder.</p>
                    </div>
                    <Link
                      href="/account"
                      className="ml-2 inline-flex items-center rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 active:bg-amber-800"
                    >
                      Starta
                    </Link>
                  </div>
                </div>
              ) : null}
            </header>

            {/* ===== CONTENT ===== */}
            <div
              className={[
                "px-4 py-4",
                "bg-transparent border-0 shadow-none",
                "sm:p-6 sm:bg-card sm:border sm:border-border sm:rounded-lg sm:shadow-soft",
              ].join(" ")}
            >
              {children}
            </div>
          </main>

          {/* ===== FOOTER ===== */}
          <Footer />
        </div>
        </AppSessionProvider>
      </body>
    </html>
  );
}







