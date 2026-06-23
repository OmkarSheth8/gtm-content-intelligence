export const dynamic = "force-dynamic";

import Link from "next/link";
import { prisma } from "@/lib/db";
import { AddSourceForm } from "@/app/sources/AddSourceForm";

export default async function SourcesPage() {
  const accounts = await prisma.platformAccount.findMany({
    include: {
      _count: { select: { contentItems: true } },
      syncRuns: {
        where: { status: "success" },
        orderBy: { startedAt: "desc" },
        take: 1,
        select: { startedAt: true, snapshotsInserted: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="p-8 space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold">Sources</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Connect YouTube channels and Blog/RSS feeds. Each source gets its own
          scoped dashboard, recommendations, and ROI view.
        </p>
      </div>

      {accounts.length > 0 && (
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
            <h2 className="text-sm font-medium">Connected Sources</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-900">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide">
                  Source
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide">
                  Content
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide">
                  Last Synced
                </th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => {
                const lastSync = account.syncRuns[0];
                return (
                  <tr
                    key={account.id}
                    className="border-t border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{account.accountName}</span>
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide ${
                            account.platform === "youtube"
                              ? "bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400"
                              : "bg-orange-50 text-orange-600 dark:bg-orange-950 dark:text-orange-400"
                          }`}
                        >
                          {account.platform === "youtube" ? "YouTube" : "RSS"}
                        </span>
                      </div>
                      <div className="text-xs text-zinc-400 mt-0.5 truncate max-w-xs">
                        {account.accountId}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-zinc-500">
                      {account._count.contentItems}
                    </td>
                    <td className="px-4 py-3 text-zinc-500">
                      {lastSync
                        ? new Date(lastSync.startedAt).toLocaleDateString(
                            "en-US",
                            {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            }
                          )
                        : "Never"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/dashboard?accountId=${account.id}`}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        View Dashboard →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {accounts.length === 0 && (
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-8 text-center text-sm text-zinc-400">
          No sources connected yet. Add one below.
        </div>
      )}

      <AddSourceForm />
    </div>
  );
}