"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

// Reads accountId from the current URL and threads it through nav links.
// Wrapped in <Suspense> by the layout to satisfy Next.js requirements.
export function AccountNav() {
  const searchParams = useSearchParams();
  const accountId = searchParams.get("accountId");
  const q = accountId ? `?accountId=${accountId}` : "";

  return (
    <nav className="flex gap-6 text-sm">
      <Link
        href="/sources"
        className="hover:text-blue-600 transition-colors"
      >
        Sources
      </Link>
      <Link
        href={`/dashboard${q}`}
        className="hover:text-blue-600 transition-colors"
      >
        Dashboard
      </Link>
      <Link
        href={`/recommendations${q}`}
        className="hover:text-blue-600 transition-colors"
      >
        Recommendations
      </Link>
      <Link
        href={`/roi${q}`}
        className="hover:text-blue-600 transition-colors"
      >
        ROI
      </Link>
    </nav>
  );
}