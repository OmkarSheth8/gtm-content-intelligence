import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Tracking redirect: records a click event then redirects to the content URL
// GET /r/:contentId
// Phase 6: log click to content_events, look up URL from content_items, redirect
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ contentId: string }> }
) {
  const { contentId } = await params;

  // Phase 6: log click event
  // await logContentEvent(contentId, 'click', _request)

  // Phase 6: look up destination URL
  // const item = await prisma.contentItem.findUnique({ where: { id: contentId } })
  // if (item) return NextResponse.redirect(item.url)

  return NextResponse.json({
    message: "Tracking redirect placeholder — Phase 6",
    contentId,
  });
}