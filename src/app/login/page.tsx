// src/app/login/page.tsx
"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { MuseoModerno } from "next/font/google";

/* ---- små UI-byggstenar ---- */
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

function TInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={[
        "h-7 w-full rounded-md border border-border bg-white/95 px-2 text-[13px] text-foreground",
        "placeholder:text-foreground/50 shadow-[inset_0_1px_0_rgba(0,0,0,.03)]",
        "focus:outline-none focus:ring-2 focus:ring-primary/25",
        props.className || "",
      ].join(" ")}
    />
  );
}

const museoModerno = MuseoModerno({
  subsets: ["latin"],
  weight: ["400", "700"],
});

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await signIn("credentials", {
      email,
      password,
      callbackUrl: "/",
      redirect: false,
    });

    setLoading(false);
    if (res?.error) setError("Fel e-post eller lösenord");
    else if (res?.ok) window.location.href = "/";
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-[400px] p-4 md:p-6">
        <h1
          className={`${museoModerno.className} mb-6 text-center text-xl font-semibold`}
        >
          Logga in
        </h1>

        <form
          onSubmit={handleSubmit}
          className="rounded-[12px] border border-border bg-card p-5 shadow-sm space-y-4"
        >
          <Field label="E-post">
            <TInput
              type="email"
              placeholder="namn@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>

          <Field label="Lösenord">
            <TInput
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>

          {error && (
            <div className="rounded-md border border-danger/30 bg-danger/10 p-2 text-[13px] text-danger">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="
              mt-2 inline-flex w-full items-center justify-center
              rounded-xl bg-emerald-500 px-4 py-2 text-sm font-medium text-white
              hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-400
            "
          >
            {loading ? "Loggar in…" : "Logga in"}
          </button>
        </form>
      </div>
    </div>
  );
}
