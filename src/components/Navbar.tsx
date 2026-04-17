"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Inicio" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/analytics", label: "Analytics" },
  { href: "/accounts", label: "Cuentas" },
];

export default function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 border-b border-white/5" style={{ background: "#0d0d0d" }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-full overflow-hidden shrink-0 ring-1 ring-white/10 group-hover:ring-white/25 transition-all">
              <Image
                src="/brand/ndsocial-rocket.png"
                width={36}
                height={36}
                alt="NDSocial"
                className="w-full h-full object-cover"
                priority
              />
            </div>
            <span className="font-bold text-white text-base leading-none tracking-tight">
              NDS<span className="font-light text-white/70">ocial</span>
              <span
                className="ml-0.5 font-semibold"
                style={{ color: "#ffffff" }}
              >
                Autopilot
              </span>
            </span>
          </Link>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-0.5">
            {links.map((l) => {
              const active = pathname === l.href;
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? "text-white bg-white/10"
                      : "text-white/50 hover:text-white/90 hover:bg-white/6"
                  }`}
                  style={active ? { color: "#f97316" } : undefined}
                >
                  {l.label}
                </Link>
              );
            })}
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/8 transition-colors"
            onClick={() => setOpen(!open)}
            aria-label="Menú"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {open ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile menu */}
        {open && (
          <div className="md:hidden pb-3 space-y-0.5 border-t border-white/8 pt-2">
            {links.map((l) => {
              const active = pathname === l.href;
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className={`block px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? "bg-white/10 text-white"
                      : "text-white/55 hover:bg-white/6 hover:text-white/90"
                  }`}
                  style={active ? { color: "#f97316" } : undefined}
                >
                  {l.label}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </nav>
  );
}
