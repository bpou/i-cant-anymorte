import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

type AnimatedOption = {
  value: string;
  label: string;
  hint?: string;
  disabled?: boolean;
};

export function AnimatedSelect({
  value,
  onChange,
  options,
  placeholder = "Välj…",
  className = "",
  buttonClassName = "",
  menuMaxHeight = 280,
  itemClassName = "",
}: {
  value: string;
  onChange: (v: string) => void;
  options: AnimatedOption[];
  placeholder?: string;
  className?: string;
  buttonClassName?: string;
  menuMaxHeight?: number;
  itemClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const selected = useMemo(
    () => options.find((o) => o.value === value),
    [options, value]
  );

  // stäng vid klick utanför
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  // enkel tangent-navigering
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const idx = options.findIndex((o) => o.value === value);
        const dir = e.key === "ArrowDown" ? 1 : -1;
        let next = idx;
        for (let i = 0; i < options.length; i++) {
          next = (next + dir + options.length) % options.length;
          if (!options[next].disabled) break;
        }
        onChange(options[next].value);
      }
      if (e.key === "Enter" || e.key === " ") setOpen((o) => !o);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, options, value, onChange]);

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={[
          "h-9 w-full rounded-md border border-border bg-white/95 px-3 text-sm",
          "flex items-center justify-between gap-2",
          "hover:bg-white focus:outline-none focus:ring-2 focus:ring-primary/25",
          buttonClassName,
        ].join(" ")}
      >
        <span className={selected ? "text-foreground" : "text-foreground/50"}>
          {selected ? (
            <span className="inline-flex items-center gap-2">
              <span>{selected.label}</span>
              {selected.hint ? (
                <span className="text-xs text-foreground/50">{selected.hint}</span>
              ) : null}
            </span>
          ) : (
            placeholder
          )}
        </span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          className={`transition-transform ${open ? "rotate-180" : "rotate-0"}`}
        >
          <path
            d="M6 9l6 6 6-6"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.14 }}
            className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border border-border bg-white shadow-xl"
            role="listbox"
          >
            <div
              className="max-h-[var(--menu-h)] overflow-auto"
              style={{ ["--menu-h" as any]: `${menuMaxHeight}px` }}
            >
              <motion.ul
                initial="hidden"
                animate="show"
                exit="hidden"
                variants={{
                  hidden: { transition: { staggerChildren: 0.02, staggerDirection: -1 } },
                  show: { transition: { staggerChildren: 0.04 } },
                }}
                className="py-1"
              >
                {options.map((opt, i) => (
                  <motion.li
                    key={opt.value}
                    variants={{
                      hidden: { opacity: 0, y: -12, filter: "blur(3px)" },
                      show: {
                        opacity: 1,
                        y: 0,
                        filter: "blur(0px)",
                        transition: {
                          type: "spring",
                          stiffness: 400,
                          damping: 22,
                          mass: 0.4 + i * 0.02, // liten massaökning → “repstege”
                        },
                      },
                    }}
                    className={[
                      "px-2.5 py-2 text-sm cursor-pointer select-none",
                      opt.disabled
                        ? "opacity-40 cursor-not-allowed"
                        : "hover:bg-neutral-50",
                      value === opt.value ? "bg-neutral-50/70" : "",
                      itemClassName,
                    ].join(" ")}
                    aria-selected={value === opt.value}
                    onClick={() => {
                      if (opt.disabled) return;
                      onChange(opt.value);
                      setOpen(false);
                    }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate">{opt.label}</span>
                      {opt.hint ? (
                        <span className="text-xs text-foreground/45">{opt.hint}</span>
                      ) : null}
                    </div>
                  </motion.li>
                ))}
              </motion.ul>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
