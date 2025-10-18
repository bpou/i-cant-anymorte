// src/app/login/page.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { signIn } from "next-auth/react";
import { MuseoModerno } from "next/font/google";
import { AnimatePresence, motion } from "framer-motion";
import { Eye, EyeOff, Mail, Lock, Loader2, ShieldCheck } from "lucide-react";

/* ---- sma UI-byggstenar ---- */
function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-1 ${className}`}>
      <span className="text-[12px] font-medium text-foreground/80">{label}</span>
      {children}
    </label>
  );
}

function InputShell({
  icon,
  right,
  children,
  invalid = false,
}: {
  icon?: React.ReactNode;
  right?: React.ReactNode;
  children: React.ReactNode;
  invalid?: boolean;
}) {
  return (
    <div
      className={[
        "group/input relative flex items-center rounded-xl border bg-white/95",
        invalid ? "border-danger/50 ring-2 ring-danger/10" : "border-border",
        "shadow-[inset_0_1px_0_rgba(0,0,0,.03)]",
        "focus-within:ring-2 focus-within:ring-primary/25",
      ].join(" ")}
    >
      {icon ? (
        <div className="pl-3 text-foreground/50 group-focus-within/input:text-foreground/70 transition-colors">
          {icon}
        </div>
      ) : null}
      <div className="flex-1 px-2">{children}</div>
      {right ? <div className="pr-3">{right}</div> : null}
    </div>
  );
}

const museoModerno = MuseoModerno({
  subsets: ["latin"],
  weight: ["400", "700"],
});

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [needsOtp, setNeedsOtp] = useState(false);
  const [checkingOtp, setCheckingOtp] = useState(false);
  const [reveal, setReveal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastCheckedEmail = useRef<string | null>(null);

  // Focus OTP input when it appears
  const otpRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (needsOtp) otpRef.current?.focus();
  }, [needsOtp]);

  useEffect(() => {
    const normalized = email.trim().toLowerCase();
    if (!normalized) {
      setNeedsOtp(false);
      setOtp("");
      lastCheckedEmail.current = null;
      return;
    }

    if (lastCheckedEmail.current === normalized) {
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        setCheckingOtp(true);
        const res = await fetch("/api/auth/mfa-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: normalized }),
          signal: controller.signal,
        });

        if (!res.ok) {
          return;
        }

        const data = (await res.json()) as { requiresOtp?: boolean };
        const requiresOtp = Boolean(data?.requiresOtp);
        setNeedsOtp(requiresOtp);
        if (!requiresOtp) {
          setOtp("");
        }
        lastCheckedEmail.current = normalized;
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          console.error("Failed to check MFA status", err);
        }
      } finally {
        setCheckingOtp(false);
      }
    }, 400);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [email]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (needsOtp && !otp.trim()) {
      setError("Fyll i engangskoden fran din authenticator-app.");
      return;
    }

    setLoading(true);

    const res = await signIn("credentials", {
      email,
      password,
      otp: otp.trim() || undefined,
      callbackUrl: "/",
      redirect: false,
    });

    setLoading(false);

    if (res?.error) {
      if (res.error === "MFA_REQUIRED") {
        setNeedsOtp(true);
        setError("Ange koden fran din authenticator-app.");
        return;
      }
      if (res.error === "INVALID_OTP") {
        setNeedsOtp(true);
        setError("Fel engangskod. Forsok igen.");
        return;
      }
      setError("Fel e-post eller losenord.");
      return;
    }

    if (res?.ok) {
      window.location.href = "/";
    }
  }

  return (
    <>
      {/* ROOT - no overflow-hidden on the page wrapper */}
      <div className="relative min-h-screen flex items-center justify-center bg-background">
        {/* === BACKDROP LAYER (behind page, viewport-sized) === */}
        <div aria-hidden className="fixed inset-0 -z-10 overflow-hidden">
          <motion.div
            className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-brand-500/25 blur-3xl"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1.1 }}
            transition={{ duration: 1.2, ease: "easeOut" }}
          />
          <motion.div
            className="absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-emerald-400/20 blur-3xl"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1.15 }}
            transition={{ duration: 1.4, ease: "easeOut", delay: 0.1 }}
          />
          <motion.div
            className="absolute top-1/2 left-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-600/10 blur-2xl"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, ease: "easeOut", delay: 0.15 }}
          />
        </div>

        {/* Card */}
        <motion.div
          className="w-full max-w-[420px] p-4 md:p-6"
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
        >
          <motion.h1
            className={`${museoModerno.className} mb-6 text-center text-2xl font-semibold`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05, duration: 0.35 }}
          >
            Logga in
          </motion.h1>

          <motion.form
            onSubmit={handleSubmit}
            className="rounded-[16px] border border-border bg-card/95 p-5 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/80 space-y-4"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08, duration: 0.4 }}
          >
            <Field label="E-post">
              <InputShell icon={<Mail className="h-4 w-4" />}>
                <input
                  type="email"
                  autoComplete="email"
                  placeholder="namn@example.com"
                  value={email}
                  onChange={(e) => {
                    const next = e.target.value;
                    setEmail(next);
                    setError(null);
                    if (!next.trim()) {
                      setNeedsOtp(false);
                      setOtp("");
                      lastCheckedEmail.current = null;
                      return;
                    }
                    lastCheckedEmail.current = null;
                  }}
                  className="h-11 w-full bg-transparent text-[14px] text-foreground placeholder:text-foreground/50 focus:outline-none"
                />
              </InputShell>
            </Field>

            <Field label="Losenord">
              <InputShell
                icon={<Lock className="h-4 w-4" />}
                right={
                  <button
                    type="button"
                    onClick={() => setReveal((v) => !v)}
                    className="rounded-md p-1.5 text-foreground/60 hover:bg-black/5 hover:text-foreground transition"
                    aria-label={reveal ? "Dalj losenord" : "Visa losenord"}
                  >
                    {reveal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                }
              >
                <input
                  type={reveal ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="********"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 w-full bg-transparent text-[14px] text-foreground placeholder:text-foreground/50 focus:outline-none"
                />
              </InputShell>
            </Field>

            {/* OTP overlay that expands downward without pushing fields above */}
            <div className="relative">
              {/* Height spacer that grows/shrinks, moving only content BELOW */}
              <motion.div
                initial={false}
                animate={{ height: needsOtp ? "auto" : 0 }}
                transition={{ duration: 0.35, ease: "easeInOut" }}
                className="overflow-visible"
              >
                {/* absolutely-positioned OTP lives inside this space */}
                <AnimatePresence initial={false} mode="wait">
                  {needsOtp && (
                    <motion.div
                      key="otp-absolute-panel"
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.35, ease: "easeInOut" }}
                      className="absolute inset-x-0 top-0"
                    >
                      <Field label={checkingOtp ? "Engangskod (kontrollerar...)" : "Engangskod"}>
                        <InputShell icon={<ShieldCheck className="h-4 w-4" />} invalid={Boolean(error && needsOtp)}>
                          <input
                            ref={otpRef}
                            type="text"
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            placeholder="123456"
                            value={otp}
                            onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ""))}
                            className="h-11 w-full bg-transparent text-[14px] text-foreground placeholder:text-foreground/50 focus:outline-none"
                          />
                        </InputShell>
                        <p className="text-[11px] text-foreground/60">
                          Oppna din authenticator-app och skriv in den aktuella koden.
                        </p>
                      </Field>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* invisible intrinsic-height clone to give the spacer its size when shown */}
                {needsOtp && (
                  <div className="invisible pointer-events-none">
                    <Field label="Engangskod">
                      <InputShell>
                        <div className="h-11" />
                      </InputShell>
                      <p className="text-[11px]">.</p>
                    </Field>
                  </div>
                )}
              </motion.div>
            </div>

            {/* Error toast */}
            <motion.div
              role="status"
              aria-live="polite"
              initial={false}
              animate={error ? { opacity: 1, y: 0, height: "auto" } : { opacity: 0, y: -6, height: 0 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              {error && (
                <div className="flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-[13px] text-danger">
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-danger/70" />
                  {error}
                </div>
              )}
            </motion.div>

            {/* Actions */}
            <div className="flex items-center justify-between gap-3 pt-1">
              <label className="flex select-none items-center gap-2 text-[13px] text-foreground/70">
                <input type="checkbox" className="h-4 w-4 rounded border-border text-brand-600 focus:ring-brand-400" />
                Hall mig inloggad
              </label>
              <a href="/reset" className="text-[13px] text-brand-700 hover:text-brand-800 hover:underline">
                Glomt losenord?
              </a>
            </div>

            <motion.button
              type="submit"
              disabled={loading}
              whileTap={{ scale: 0.98 }}
              className="mt-1 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 px-4 py-3 text-sm font-medium text-white hover:bg-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-400 disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loggar in...
                </>
              ) : (
                "Logga in"
              )}
            </motion.button>
          </motion.form>

          <motion.p
            className="mt-4 text-center text-xs text-foreground/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25 }}
          >
            Behover du ett konto? Kontakta administrator.
          </motion.p>
        </motion.div>
      </div>
    </>
  );
}
