import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const ALLOWED_EVENTS = new Set([
  "landing_page_view",
  "click",
  "demo_request",
  "lead",
]);

// Only redirect to http/https URLs — never file:, javascript:, data:, etc.
function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ contentId: string }> }
) {
  const { contentId } = await params;

  // Validate event type — reject anything not on the allowlist
  const rawEvent = new URL(request.url).searchParams.get("event") ?? "";
  const eventType = ALLOWED_EVENTS.has(rawEvent) ? rawEvent : "click";

  // Look up the content item
  const item = await prisma.contentItem.findUnique({
    where: { id: contentId },
    select: { id: true, url: true },
  });

  if (!item) {
    return new NextResponse("Not found", { status: 404 });
  }

  // Validate destination URL before redirecting
  const destination = isSafeUrl(item.url)
    ? item.url
    : new URL("/dashboard", request.url).toString();

  // Record the event — redirect regardless of whether logging succeeds
  try {
    await prisma.contentEvent.create({
      data: {
        contentItemId: item.id,
        eventType,
        referrer: request.headers.get("referer") ?? null,
        metadata: { source: "tracked_link" },
      },
    });
  } catch (err) {
    console.warn(
      "ContentEvent logging failed for item",
      contentId,
      ":",
      err instanceof Error ? err.message : String(err)
    );
  }

  return NextResponse.redirect(destination);
}