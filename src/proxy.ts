import { NextResponse, type NextRequest } from "next/server";
import { isLocalLegalPreview } from "@/lib/public-information";

// Render-time notFound() can stream with HTTP 200. Block unpublished drafts
// before rendering so their publication boundary also has the correct status.
export function proxy(request: NextRequest) {
  if (isLocalLegalPreview()) {
    if (request.nextUrl.pathname === "/privacy-policy") return NextResponse.redirect(new URL("/privacy", request.url));
    return NextResponse.next();
  }
  return new NextResponse("Not found", {
    status: 404,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" },
  });
}

export const config = {
  matcher: ["/privacy", "/privacy-policy", "/terms", "/contact", "/help/prohibited-items"],
};
