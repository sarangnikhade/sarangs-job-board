"use client";

import Link from "next/link";
import { Wordmark } from "./Wordmark";
import { useApp } from "@/lib/store";

/**
 * 56px transparent top nav per Bugatti spec.
 * Left: MENU → /settings
 * Center: wordmark → /
 * Right: ADD JOB → opens dialog (zustand store)
 */
export function TopNav() {
  const openAddJob = useApp((s) => s.openAddJob);

  return (
    <header className="relative z-50 flex h-14 items-center justify-between px-6 md:px-10">
      <nav className="flex-1">
        <Link href="/settings" className="nav-link">
          MENU
        </Link>
      </nav>

      <div className="flex-1 text-center">
        <Link href="/" aria-label="Sarang's Job Board — Home">
          <Wordmark />
        </Link>
      </div>

      <div className="flex-1 text-right">
        <button
          type="button"
          className="nav-link cursor-pointer"
          onClick={openAddJob}
        >
          ADD JOB
        </button>
      </div>
    </header>
  );
}
