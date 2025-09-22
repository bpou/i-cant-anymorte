"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { signOut, signIn } from "next-auth/react";

export default function UserMenu({
  name,
  email,
  image,
  isLoggedIn,
}: {
  name?: string;
  email?: string;
  image?: string;
  isLoggedIn: boolean;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Stäng menyn när man klickar utanför
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ✅ Om ingen är inloggad → visa bara Logga in-knapp
  if (!isLoggedIn) {
    return (
      <button
        onClick={() => signIn()}
        className="
          rounded-xl border border-slate-300 bg-white
          px-4 py-1 text-sm font-medium text-slate-700
          hover:bg-slate-100
        "
      >
        Logga in
      </button>
    );
  }

  // ✅ Om användaren är inloggad → visa profilmeny
  return (
    <div className="relative" ref={menuRef}>
      <button onClick={() => setOpen((o) => !o)} className="focus:outline-none">
        <Image
          src={image || "/default-avatar.png"}
          alt="Profilbild"
          width={36}
          height={36}
          className="rounded-full border border-slate-300 hover:ring-2 hover:ring-primary/30 transition"
        />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-200 bg-white shadow-lg p-3 z-50">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-3 mb-3">
            <Image
              src={image || "/default-avatar.png"}
              alt="Profil"
              width={40}
              height={40}
              className="rounded-full border border-slate-300"
            />
            <div>
              <p className="text-sm font-medium text-slate-800">{name}</p>
              <p className="text-xs text-slate-500">{email}</p>
            </div>
          </div>

          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="
              w-full text-left rounded-lg px-3 py-2
              text-sm font-medium text-slate-700
              hover:bg-slate-100
            "
          >
            Logga ut
          </button>
        </div>
      )}
    </div>
  );
}
