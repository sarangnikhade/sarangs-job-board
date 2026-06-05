"use client";

import Link from "next/link";
import { Wordmark } from "./Wordmark";
import { useApp } from "@/lib/store";
import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";

type Me = { name: string; email: string; image: string };

export function TopNav() {
  const openAddJob = useApp((s) => s.openAddJob);
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((p: Me | null) => setMe(p))
      .catch(() => setMe(null));
  }, []);

  const initials = (me?.name || me?.email || "?")
    .split(" ")
    .map((w) => w.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="relative z-50 flex h-14 items-center justify-between px-6 md:px-10 gap-4">
      <nav className="flex-1 flex items-center gap-6">
        <Link href="/settings" className="nav-link">
          MENU
        </Link>
      </nav>

      <div className="flex-1 text-center">
        <Link href="/" aria-label="Sarang's Job Board — Home">
          <Wordmark />
        </Link>
      </div>

      <div className="flex-1 text-right flex items-center justify-end gap-4">
        <button
          type="button"
          className="nav-link cursor-pointer"
          onClick={openAddJob}
        >
          ADD JOB
        </button>
        {me && (
          <button
            type="button"
            onClick={() => signOut({ redirectTo: "/signin" })}
            title={`Sign out ${me.email}`}
            className="flex items-center justify-center"
            style={{
              width: 36,
              height: 36,
              borderRadius: 9999,
              border: "1px solid var(--color-hairline-strong)",
              background: "transparent",
              color: "var(--color-on-dark)",
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: "1px",
              cursor: "pointer",
            }}
          >
            {initials}
          </button>
        )}
      </div>
    </header>
  );
}
