"use client";
import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";

/**
 * OrdinaLoader – logo breathing + single outline "snake" tracer
 * - Seamless single snake with constant speed
 * - Brand color stroke (no gradient) + soft glow
 */

type LoaderProps = {
  show?: boolean;
  logoSrc?: string;
  background?: string; // Tailwind class
  blur?: boolean;
};

const OrdinaLoader: React.FC<LoaderProps> = ({
  show = true,
  logoSrc = "/N.svg",
  background = "bg-black",
  blur = true,
}) => {
  const [renderOverlay, setRenderOverlay] = useState(show);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    if (show) {
      setRenderOverlay(true);
    } else {
      timeout = setTimeout(() => setRenderOverlay(false), 260);
    }
    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [show]);

  return (
    <AnimatePresence mode="wait">
      {renderOverlay && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: show ? 1 : 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.28, ease: "easeInOut" }}
          className={`fixed inset-0 z-[9999] ${background} ${
            blur ? "backdrop-blur-sm" : ""
          } flex items-center justify-center`}
          style={{ pointerEvents: show ? "auto" : "none" }}
          aria-label="Loading"
          role="status"
        >
          <LogoWithTracer logoSrc={logoSrc} />
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export const OrdinaLogoSpinner: React.FC<{
  logoSrc?: string;
  size?: number;
}> = ({ logoSrc = "/N.svg", size = 56 }) => (
  <div className="inline-flex items-center justify-center" aria-label="Loading">
    <LogoWithTracer logoSrc={logoSrc} size={size} />
  </div>
);

export default OrdinaLoader;

function LogoWithTracer({
  logoSrc,
  size = 112,
}: {
  logoSrc: string;
  size?: number;
}) {
  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* Scale BOTH the image and the tracer together so thickness tracks size */}
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: [0.92, 1.03, 0.92], opacity: [0, 1, 0] }}

        className="relative w-full h-full"
      >
        {/* Base logo */}
        <Image
          src={logoSrc}
          alt="Ordina logo"
          fill
          sizes="100%"
          className="object-contain"
          priority
        />
        {/* Outline tracer overlay — color via brand variable */}
        <div
          className="absolute inset-0 z-10"
          style={{ color: "var(--color-brand-500)" }}
        >
          <SvgOutlineTracer src={logoSrc} />
        </div>
      </motion.div>
    </div>
  );
}

/**
 * Loads an SVG, extracts its <path> elements, and animates a single dash
 * that "snakes" along the outline with seamless off-path entry/exit.
 */
function SvgOutlineTracer({ src }: { src: string }) {
  const [viewBox, setViewBox] = useState<string | undefined>(undefined);
  const [paths, setPaths] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch(src)
      .then((r) => r.text())
      .then((txt) => {
        if (cancelled) return;
        const doc = new DOMParser().parseFromString(txt, "image/svg+xml");
        const svg = doc.querySelector("svg");
        if (!svg) return;
        const vb = svg.getAttribute("viewBox") || undefined;
        setViewBox(vb);
        const found: string[] = [];
        svg.querySelectorAll("path").forEach((p) => {
          const d = p.getAttribute("d");
          if (d) found.push(d);
        });
        if (found.length === 0) {
          svg.querySelectorAll("polyline, polygon").forEach((pl) => {
            const d = (pl as SVGGeometryElement).getAttribute("points");
            if (d) found.push(`M ${d}`);
          });
        }
        setPaths(found);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [src]);

  if (!paths.length) return null;

  // Keep your values:
  const dash = 0.4;
  const lapsPerSecond = 0.6;
  const duration = (1 + dash) / lapsPerSecond; // seamless + constant speed

  return (
    <svg
      viewBox={viewBox}
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid meet"
      className="block"
    >
      {/* Soft head glow (uses the current stroke color via SourceGraphic) */}
      <defs>
        <filter id="ordina-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {paths.map((d, i) => (
        <motion.path
          key={`snake-${i}`}
          d={d}
          fill="none"
          stroke="currentColor"        // <-- brand color (no gradient)
          strokeWidth={35}             // <-- unchanged
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#ordina-glow)"
          pathLength={1 + dash}        // seamless cycle
          strokeDasharray={`${dash} 1`}
          initial={{ strokeDashoffset: dash, opacity: 0 }}
          animate={{
            strokeDashoffset: dash - (1 + dash),
            opacity: [0, 1, 0],
          }}
          transition={{
            strokeDashoffset: {
              repeat: Infinity,
              duration,
              ease: "linear",
              repeatType: "loop",
              delay: i * 0.08,
            },
            opacity: {
              repeat: Infinity,
              duration: duration * 1.2,
              ease: "easeInOut",
              repeatType: "mirror",
              delay: i * 0.08,
            },
          }}
        />
      ))}
    </svg>
  );
}

/** Optional: Pages Router route-change loader */
export const RouteChangeLoader: React.FC<{ logoSrc?: string }> = ({
  logoSrc = "/N.svg",
}) => {
  const [show, setShow] = useState(false);
  useEffect(() => {
    let off: Array<() => void> = [];
    try {
      import("next/router").then(({ default: Router }) => {
        const start = () => setShow(true);
        const done = () => setShow(false);
        Router.events.on("routeChangeStart", start);
        Router.events.on("routeChangeComplete", done);
        Router.events.on("routeChangeError", done);
        off.push(() => {
          Router.events.off("routeChangeStart", start);
          Router.events.off("routeChangeComplete", done);
          Router.events.off("routeChangeError", done);
        });
      });
    } catch {}
    return () => off.forEach((f) => f());
  }, []);
  return <OrdinaLoader show={show} logoSrc={logoSrc} />;
};
