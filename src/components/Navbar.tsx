"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Inicio" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/analytics", label: "Analytics" },
];

export default function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">SA</span>
            </div>
            <span className="font-bold text-gray-900 text-lg leading-none">
              Social<span className="text-blue-500">Autopilot</span>
            </span>
          </Link>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-1">
            {links.map((l) => {
              const active = pathname === l.href;
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? "bg-blue-50 text-blue-600"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  }`}
                >
                  {l.label}
                </Link>
              );
            })}
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100"
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
          <div className="md:hidden pb-3 space-y-1">
            {links.map((l) => {
              const active = pathname === l.href;
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className={`block px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? "bg-blue-50 text-blue-600"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
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
