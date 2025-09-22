"use client";
import { cn } from "@/lib/cn";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md";
};

export default function Button({ className, variant = "primary", size = "md", ...props }: Props) {
  const base = "inline-flex items-center gap-2 rounded-[var(--radius)] font-medium transition active:scale-[.98] focus:outline-none focus:ring-2 focus:ring-primary/40";
  const sizes = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2",
  }[size];

  const variants = {
    primary: "bg-primary text-white hover:opacity-90 shadow-sm",
    outline: "border border-border text-foreground hover:bg-primary/10",
    ghost:   "text-foreground hover:bg-muted/10",
    danger:  "bg-danger text-white hover:opacity-90 shadow-sm",
  }[variant];

  return <button className={cn(base, sizes, variants, className)} {...props} />;
}
