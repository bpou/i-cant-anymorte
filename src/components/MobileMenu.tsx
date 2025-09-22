"use client";

import { useState } from "react";
import Image from "next/image";
import NavLinks from "./NavLinks";

export default function MobileMenu() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* 🔔 Knapp med egen bild istället för SVG */}
      <button
        type="button"
        aria-label="Öppna meny"
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center rounded p-2 hover:bg-slate-100"
      >
        <Image
          src="/icons/hamburger.svg"   // <-- lägg din bild i /public/icons
          alt="Meny"
          width={40}
          height={40}
        />
      </button>

      {open && (
        <div className="fixed inset-0 z-50">
          <button
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
            aria-label="Stäng meny"
          />
          <div
            className="absolute left-0 top-0 h-full w-72 bg-white shadow-xl border-r border-slate-200 p-4"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="font-bold text-lg">Ordina</div>
              <button
                aria-label="Stäng meny"
                onClick={() => setOpen(false)}
                className="rounded p-2 hover:bg-slate-100"
              >
                {/* Du kan även byta ut stäng-ikonen mot en egen bild */}
                <Image src="/icons/hamburger_close.svg" alt="Stäng" width={20} height={20} />
              </button>
            </div>

            <NavLinks />
          </div>
        </div>
      )}
    </>
  );
}
