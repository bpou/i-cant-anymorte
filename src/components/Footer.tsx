"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowUp, Facebook, Github, Instagram, Linkedin } from "lucide-react";
import { FOOTER_LINK_GROUPS } from "@/lib/marketing-pages";

const social = [
  { href: "https://github.com/ordina-app", label: "GitHub", Icon: Github },
  { href: "https://www.linkedin.com/company/ordina", label: "LinkedIn", Icon: Linkedin },
  { href: "https://www.instagram.com/ordinase", label: "Instagram", Icon: Instagram },
  { href: "https://www.facebook.com/ordinase", label: "Facebook", Icon: Facebook },
] as const;

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="text-foreground border-t border-border" style={{ backgroundColor: "var(--color-card)" }}>
      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <Link href="/" className="inline-flex items-center gap-3">
              <Image
                src="/logo.png"
                alt="Ordina"
                width={160}
                height={28}
                className="h-7 w-auto object-contain"
                priority
              />
            </Link>
            <p className="mt-4 max-w-sm text-sm leading-6 text-muted-foreground">
              Ordina hjalper dig att skapa ordning i jobbet med enkel planering, tydliga arbetsfloden och smidigt
              samarbete oavsett teamstorlek.
            </p>

            <div className="mt-6 hidden items-center gap-3">
              {social.map(({ href, label, Icon }) => (
                <Link
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="group inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border transition hover:shadow-sm"
                >
                  <Icon className="h-5 w-5" aria-hidden="true" />
                  <span className="sr-only">{label}</span>
                </Link>
              ))}
            </div>
          </div>

          <div className="lg:col-span-8 grid grid-cols-2 gap-8 sm:grid-cols-4">
            {FOOTER_LINK_GROUPS.map(({ heading, links }) => (
              <nav key={heading} aria-label={heading}>
                <h3 className="text-sm font-semibold text-foreground">{heading}</h3>
                <ul className="mt-4 space-y-3">
                  {links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="rounded text-sm text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-border"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 py-4 sm:flex-row">
          <p className="text-xs sm:text-sm">&copy; {year} Ordina. Alla rattigheter forbehallna.</p>

          <div className="flex items-center gap-3 text-xs sm:text-sm">
            <Link href="/accessibility" className="transition-colors hover:text-foreground">
              Tillganglighet
            </Link>
            <span className="text-muted-foreground">|</span>
            <a href="#top" className="inline-flex items-center gap-1 transition-colors hover:text-foreground">
              <ArrowUp className="h-4 w-4" aria-hidden="true" />
              Till toppen
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
