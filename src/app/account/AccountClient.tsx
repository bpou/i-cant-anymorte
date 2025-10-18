"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { motion } from "framer-motion";
import {
  Bell,
  LogOut,
  Mail,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  UserCircle,
  UserCog,
} from "lucide-react";
import Button from "@/components/ui/Button";
import { OrdinaLogoSpinner } from "@/components/OrdinaLoader";
type AccountClientProps = {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    image?: string | null;
    mfaEnabled: boolean;
  };
};

type NotificationPrefs = typeof notificationDefaults;

type TotpSetupState = {
  qrCode: string;
  manualKey: string;
};

const notificationDefaults = {
  orderUpdates: true,
  calendarDigest: true,
  securityAlerts: true,
};

const notificationCopy = [
  {
    key: "orderUpdates" as const,
    label: "Orderuppdateringar",
    description: "Meddela mig nar orderstatus eller filer uppdateras i mina spar.",
  },
  {
    key: "calendarDigest" as const,
    label: "Kalender",
    description: "Sammanfattning varje morgon med dagens belaggning och deadlines.",
  },
  {
    key: "securityAlerts" as const,
    label: "Sakerhet",
    description: "Snabba varningar om vi ser inloggningar eller andringar fran nya enheter.",
  },
];

export default function AccountClient({ user }: AccountClientProps) {
  const router = useRouter();
  const [prefs, setPrefs] = useState<NotificationPrefs>(notificationDefaults);

  const [mfaEnabled, setMfaEnabled] = useState(Boolean(user.mfaEnabled));
  const [mfaStatusLoading, setMfaStatusLoading] = useState(true);
  const [mfaPending, setMfaPending] = useState(false);
  const [mfaBusy, setMfaBusy] = useState(false);
  const [setup, setSetup] = useState<TotpSetupState | null>(null);
  const [otpCode, setOtpCode] = useState("");
  const [mfaMessage, setMfaMessage] = useState<{ kind: "error" | "success"; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/account/mfa/totp", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        setMfaEnabled(Boolean(data.enabled));
        setMfaPending(Boolean(data.pending));
      } catch (error) {
        console.error("Could not load MFA status", error);
      } finally {
        if (!cancelled) setMfaStatusLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const roleLabel = useMemo(() => {
    switch (user.role) {
      case "ADMIN":
        return "Administrator";
      case "SALJARE":
        return "Saljare";
      case "A_TEAM":
        return "Atelje/Bilmontage";
      case "B_TEAM":
        return "Verkstad/Montage";
      case "C_TEAM":
        return "Spar C";
      case "D_TEAM":
        return "Spar D";
      default:
        return user.role;
    }
  }, [user.role]);

  function togglePref(key: keyof NotificationPrefs) {
    setPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function startSetup() {
    setMfaBusy(true);
    setMfaMessage(null);
    try {
      const res = await fetch("/api/account/mfa/totp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setMfaMessage({ kind: "error", text: data?.error ?? "Kunde inte skapa ny kod." });
        return;
      }
      const data = (await res.json()) as TotpSetupState & { otpAuthUrl: string };
      setSetup({ qrCode: data.qrCode, manualKey: data.manualKey });
      setOtpCode("");
      setMfaPending(false);
    } catch (error) {
      console.error("TOTP start error", error);
      setMfaMessage({ kind: "error", text: "Ett ovantat fel uppstod." });
    } finally {
      setMfaBusy(false);
    }
  }

  async function verifySetup() {
    if (!setup) return;
    const token = otpCode.trim();
    if (!token) {
      setMfaMessage({ kind: "error", text: "Fyll i koden fran din authenticator-app." });
      return;
    }

    setMfaBusy(true);
    setMfaMessage(null);
    try {
      const res = await fetch("/api/account/mfa/totp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify", token }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setMfaMessage({ kind: "error", text: data?.error ?? "Koden stammer inte." });
        return;
      }
      setMfaEnabled(true);
      setSetup(null);
      setOtpCode("");
      setMfaMessage({ kind: "success", text: "Authenticator aktiverad." });
      router.refresh();
    } catch (error) {
      console.error("TOTP verify error", error);
      setMfaMessage({ kind: "error", text: "Ett ovantat fel uppstod." });
    } finally {
      setMfaBusy(false);
    }
  }

  async function disableMfa() {
    if (!window.confirm("Vill du stanga av authenticator?")) return;
    setMfaBusy(true);
    setMfaMessage(null);
    try {
      const res = await fetch("/api/account/mfa/totp", { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setMfaMessage({ kind: "error", text: data?.error ?? "Kunde inte avaktivera." });
        return;
      }
      setMfaEnabled(false);
      setMfaPending(false);
      setSetup(null);
      setOtpCode("");
      setMfaMessage({ kind: "success", text: "Authenticator avaktiverad." });
      router.refresh();
    } catch (error) {
      console.error("TOTP disable error", error);
      setMfaMessage({ kind: "error", text: "Ett ovantat fel uppstod." });
    } finally {
      setMfaBusy(false);
    }
  }

  const headerAnimation = {
    hidden: { opacity: 0, y: 16 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
  } as const;

  return (
    <motion.main initial="hidden" animate="visible" variants={headerAnimation} className="bg-background text-foreground">
      <div className="mx-auto max-w-4xl px-6 py-16 space-y-12">
        <header className="space-y-3">
          <p className="text-sm uppercase tracking-wide text-muted-foreground">Personliga installningar</p>
          <h1 className="text-3xl font-semibold">Mitt konto</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Hantera dina anvandaruppgifter, kontaktuppgifter och notiser. For andringar som paverkar hela teamet kontaktar du Ordina-supporten sa hjalper vi dig vidare.
          </p>
        </header>

        <section className="rounded-2xl border border-border bg-white/80 p-6 shadow-sm">
          <div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="relative h-16 w-16">
                <Image
                  src={user.image || "/default-avatar.png"}
                  alt={user.name || "Profil"}
                  fill
                  sizes="64px"
                  className="rounded-full border border-border object-cover"
                />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <UserCircle className="h-4 w-4" aria-hidden />
                  {user.id}
                </div>
                <p className="text-xl font-semibold text-foreground">{user.name || "Anvandare"}</p>
                <p className="text-sm text-muted-foreground">{user.email}</p>
              </div>
            </div>

            <div className="rounded-xl border border-dashed border-primary/40 bg-primary/5 px-4 py-3 text-sm text-primary">
              Behorighet: <strong>{roleLabel}</strong>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Kontoinformation</h2>
          <div className="grid gap-4 rounded-2xl border border-border bg-white/80 p-6 shadow-sm md:grid-cols-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Namn</p>
              <p className="mt-1 text-sm text-foreground">{user.name || "Inte angivet"}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">E-post</p>
              <p className="mt-1 text-sm text-foreground">{user.email}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Roll</p>
              <p className="mt-1 text-sm text-foreground">{roleLabel}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Anvandar-ID</p>
              <p className="mt-1 break-all text-sm text-foreground">{user.id}</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Behover du uppdatera namn eller roll? Maila
            <a className="ml-1 text-primary hover:underline" href="mailto:support@ordina.se">
              support@ordina.se
            </a>
            sa hjalper vi dig inom en arbetsdag.
          </p>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <Bell className="h-5 w-5 text-primary" aria-hidden />
            <h2 className="text-2xl font-semibold">Notifikationer</h2>
          </div>
          <div className="space-y-3">
            {notificationCopy.map((pref) => {
              const enabled = prefs[pref.key];
              return (
                <div
                  key={pref.key}
                  className="flex items-start justify-between gap-4 rounded-2xl border border-border bg-white/80 p-4 shadow-sm"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">{pref.label}</p>
                    <p className="text-xs text-muted-foreground">{pref.description}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => togglePref(pref.key)}
                    className={`relative h-6 w-11 rounded-full transition ${enabled ? "bg-primary" : "bg-muted/40"}`}
                    aria-pressed={enabled}
                    aria-label={pref.label}
                  >
                    <span
                      className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
                        enabled ? "left-5" : "left-0.5"
                      }`}
                    />
                  </button>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">Dina val sparas lokalt just nu.</p>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-primary" aria-hidden />
            <h2 className="text-2xl font-semibold">Sakerhet</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-border bg-white/80 p-5 shadow-sm">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Smartphone className="h-4 w-4" aria-hidden />
                Authenticator-app
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Koppla en authenticator-app for engangskoder vid inloggning och hojd sakerhet.
              </p>

              <div className="mt-4 space-y-3 text-sm">
                {mfaStatusLoading ? (
                  <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                    <OrdinaLogoSpinner size={20} />
                    <span>Hamtar status...</span>
                  </div>
                ) : mfaEnabled && !setup ? (
                  <>
                    <div className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700 text-xs">
                      <ShieldCheck className="h-4 w-4" aria-hidden />
                      Aktiv authenticator
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Dina inloggningar skyddas av en authenticator-app. Behall backup-koder pa ett sakert stalle.
                    </p>
                    
                    <Button variant="outline" size="sm" onClick={disableMfa} disabled={mfaBusy}>
                      {mfaBusy ? "Arbetar..." : "Avaktivera authenticator"}
                    </Button>
                  </>
                ) : setup ? (
                  <>
                    <p className="text-xs text-muted-foreground">
                      Skanna QR-koden med din authenticator-app och mata sedan in koden nedan.
                    </p>
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="rounded-xl border border-border bg-white p-2">
                        <img src={setup.qrCode} alt="QR-kod for authenticator" className="h-28 w-28 object-contain" />
                      </div>
                      <div className="space-y-2 text-xs">
                        <p className="text-muted-foreground">Manuell kod:</p>
                        <code className="inline-block rounded bg-neutral-100 px-2 py-1 text-sm tracking-widest">
                          {setup.manualKey}
                        </code>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label htmlFor="otp-code" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Verifieringskod
                      </label>
                      <input
                        id="otp-code"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        placeholder="123456"
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ""))}
                        className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="primary" size="sm" onClick={verifySetup} disabled={mfaBusy}>
                        {mfaBusy ? "Verifierar..." : "Bekrafta kod"}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSetup(null);
                          setOtpCode("");
                        }}
                        disabled={mfaBusy}
                      >
                        Avbryt
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    {mfaPending ? (
                      <div className="inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-700 text-xs">
                        <ShieldAlert className="h-4 w-4" aria-hidden />
                        Tidigare forsok hittades. Starta om nedan.
                      </div>
                    ) : null}
                    <Button variant="primary" size="sm" onClick={startSetup} disabled={mfaBusy}>
                      {mfaBusy ? "Skapar..." : "Aktivera authenticator"}
                    </Button>
                  </>
                )}

                {mfaMessage ? (
                  <p
                    className={`text-xs ${
                      mfaMessage.kind === "error" ? "text-red-600" : "text-emerald-600"
                    }`}
                  >
                    {mfaMessage.text}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-white/80 p-5 shadow-sm">
              <p className="text-sm font-semibold text-foreground">Byt losenord</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Kontakta din administrator for att aterstalla eller byta losenord.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => (window.location.href = "mailto:support@ordina.se?subject=Byte%20av%20losenord")}
              >
                <Mail className="h-4 w-4" aria-hidden />
                Maila supporten
              </Button>
            </div>
            <div className="rounded-2xl border border-border bg-white/80 p-5 shadow-sm">
              <p className="text-sm font-semibold text-foreground">Inloggade enheter</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Multi-faktor-autentisering via sms planeras. Tills dess kan du logga ut fran andra enheter nedan.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={async () => {
                  await signOut({ callbackUrl: "/login" });
                }}
              >
                <LogOut className="h-4 w-4" aria-hidden />
                Logga ut overallt
              </Button>
            </div>
          </div>
        </section>

        <section className="flex flex-col items-start gap-4 rounded-2xl border border-border bg-white/80 p-6 shadow-sm md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">Behover du hjalp?</p>
            <p className="text-xs text-muted-foreground">Supporten svarar vardagar 07-16.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" size="sm" onClick={() => window.open("https://ordina.se/support", "_blank")}>
              <UserCog className="h-4 w-4" aria-hidden />
              Hjalpcenter
            </Button>
            <Button variant="primary" size="sm" onClick={() => (window.location.href = "mailto:support@ordina.se")}>
              <Mail className="h-4 w-4" aria-hidden />
              Kontakta supporten
            </Button>
          </div>
        </section>
      </div>
    </motion.main>
  );
}




