"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { Variants, Transition } from "framer-motion";
import NavLinks from "./NavLinks";

export default function MobileMenu() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const shouldReduceMotion = useReducedMotion();

  // Lock body scroll when menu is open
  useEffect(() => {
    const root = document.documentElement;
    if (!open) return;
    const prev = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = prev;
    };
  }, [open]);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Focus close button when opening
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => closeBtnRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [open]);

  // Simple focus trap within the panel
  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "Tab") return;
    const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
    );
    if (!focusable || focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      (last as HTMLElement).focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      (first as HTMLElement).focus();
    }
  }

  // Motion
  const overlayFadeIn: Transition = { duration: shouldReduceMotion ? 0 : 0.18, ease: "easeOut" };
  const overlayFadeOut: Transition = { duration: shouldReduceMotion ? 0 : 0.12, ease: "easeIn" };

  const panelEnter: Transition = shouldReduceMotion
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 520, damping: 40 };
  const panelExit: Transition = { duration: shouldReduceMotion ? 0 : 0.14, ease: "easeIn" };

  const overlayVariants: Variants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: overlayFadeIn },
    exit: { opacity: 0, transition: overlayFadeOut },
  };

  const panelVariants: Variants = {
    hidden: { x: -28, opacity: 0, scale: 0.98, filter: "blur(4px)" },
    visible: { x: 0, opacity: 1, scale: 1, filter: "blur(0px)", transition: panelEnter },
    exit: { x: -24, opacity: 0, scale: 0.98, filter: "blur(4px)", transition: panelExit },
  };

  return (
    <>
      {/* Trigger button (brand, smooth shade change) */}
      <button
        ref={triggerRef}
        type="button"
        aria-label="Öppna meny"
        aria-expanded={open}
        aria-controls="mobile-menu-panel"
        onClick={() => setOpen(true)}
        className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand-600 text-white hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50 transition-colors duration-200"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="shrink-0">
          <path d="M4 6.5h16M4 12h16M4 17.5h16" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-50" role="presentation">
            {/* Overlay */}
            <motion.button
              type="button"
              aria-label="Stäng meny"
              className="absolute inset-0 bg-foreground/30 backdrop-blur-[1.5px]"
              onClick={() => setOpen(false)}
              initial="hidden"
              animate="visible"
              exit="exit"
              variants={overlayVariants}
            />

            {/* Sliding panel */}
            <motion.div
              id="mobile-menu-panel"
              role="dialog"
              aria-modal="true"
              aria-label="Mobilmeny"
              ref={panelRef}
              onKeyDown={handleKeyDown}
              initial="hidden"
              animate="visible"
              exit="exit"
              variants={panelVariants}
              className="absolute left-0 top-0 h-dvh w-[19rem] max-w-[88vw] bg-card/95 backdrop-blur-md border-r border-border shadow-2xl p-4 pt-[max(1rem,env(safe-area-inset-top))] flex flex-col"
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                {/* Logo */}
                <Image
                  src="/logo.png"
                  alt="Ordina"
                  width={84}
                  height={28}
                  className="h-7 w-auto object-contain"
                  priority
                />

                {/* Close button (brand) */}
                <button
                  ref={closeBtnRef}
                  aria-label="Stäng meny"
                  onClick={() => setOpen(false)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand-600 text-white hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50 transition-colors duration-200"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                  </svg>
                </button>
              </div>

              {/* Divider */}
              <div className="-mx-4 mb-4 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

              {/* NAV LINKS (keep your component, style its anchors via child selectors) */}
              <nav
                className="
                  flex flex-col gap-1
                  [&_a]:flex [&_a]:items-center [&_a]:gap-3
                  [&_a]:rounded-lg [&_a]:px-3 [&_a]:py-2
                  [&_a]:text-sm [&_a]:font-medium [&_a]:text-foreground/90
                  [&_a]:transition-colors [&_a]:duration-200
                  [&_a:hover]:bg-brand-50 [&_a:hover]:text-brand-700
                  "
              >
                <NavLinks />
              </nav>

              {/* Footer actions */}
              <div className="mt-auto grid grid-cols-2 gap-2 pt-5">
                <a
                  href="#"
                  className="flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground/85 shadow-sm transition-colors duration-200 hover:bg-neutral-100 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30"
                >
                  Hjälp & support
                </a>
                <a
                  href="#"
                  className="flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition-colors duration-200 hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50"
                >
                  Inställningar
                </a>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
