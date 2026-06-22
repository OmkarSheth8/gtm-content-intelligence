interface ContentRow {
  id: string;
  title: string;
  url: string;
  views: string;
  likes: number;
  comments: number;
  publishedAt: string;
  topic: string | null;
  format: string | null;
  engagementRate: string;
}

interface Props {
  rows: ContentRow[];
}

export default function ContentTable({ rows }: Props) {
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
        <h2 className="text-sm font-medium">Content Items</h2>
      </div>
      {rows.length === 0 ? (
        <div className="p-8 text-center text-sm text-zinc-400">
          No content yet.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-900">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide">
                  Title
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium text-zinc-500 uppercase tracking-wide">
                  Views
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium text-zinc-500 uppercase tracking-wide">
                  Engagement
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide">
                  Topic
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide">
                  Format
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide">
                  Published
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-t border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                >
                  <td className="px-4 py-3 max-w-xs">
                    <a
                      href={row.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium hover:text-blue-600 line-clamp-2"
                    >
                      {row.title}
                    </a>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {row.views}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-zinc-600">
                    {row.engagementRate}
                  </td>
                  <td className="px-4 py-3">
                    {row.topic ? (
                      <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-xs dark:bg-blue-950 dark:text-blue-300">
                        {row.topic}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-zinc-500 capitalize">
                    {row.format ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-zinc-500">{row.publishedAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}