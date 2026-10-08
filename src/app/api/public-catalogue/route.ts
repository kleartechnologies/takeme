import { getPublicHomePage } from "@/lib/firebase/public-catalogue-server";
export const dynamic = "force-dynamic";

// Only a bounded, anonymous, public Home feed; never forwards incoming cookies/credentials.
export async function GET() {
  const page = await getPublicHomePage();
  return Response.json(page ?? { error: "Public catalogue unavailable" }, {
    status: page ? 200 : 503, headers: { "Cache-Control": "no-store" },
  });
}
