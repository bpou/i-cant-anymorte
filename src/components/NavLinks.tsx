// components/NavLinks.tsx
import Link from "next/link";

export default function NavLinks() {
  return (
    <nav className="space-y-1">
      <Link className="block px-3 py-2 rounded hover:bg-slate-100" href="/">Översikt</Link>
      <Link className="block px-3 py-2 rounded hover:bg-slate-100" href="/orders/new">Ny order</Link>
      <Link className="block px-3 py-2 rounded hover:bg-slate-100" href="/orders/track/A">Översikt - Ateljé</Link>
      <Link className="block px-3 py-2 rounded hover:bg-slate-100" href="/orders/track/A">Översikt - Verkstad</Link>
      <Link className="block px-3 py-2 rounded hover:bg-slate-100" href="/calendar/a">Kalender A</Link>
      <Link className="block px-3 py-2 rounded hover:bg-slate-100" href="/calendar/b">Kalender B</Link>
    </nav>
  );
}
