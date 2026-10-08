import { cookies } from "next/headers";
import {
  adminSessionCookie,
  verifyAdminToken,
} from "@admin/lib/server-session";
function sameOrigin(request: Request) {
  return request.headers.get("origin") === new URL(request.url).origin;
}
export async function POST(request: Request) {
  if (
    !sameOrigin(request) ||
    Number(request.headers.get("content-length") ?? 0) > 9000
  )
    return new Response(null, { status: 403 });
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return new Response(null, { status: 400 });
  let token: unknown;
  try {
    const reader = request.body?.getReader();
    if (!reader) return new Response(null, { status: 400 });
    const chunks: Uint8Array[] = [];
    let length = 0;
    for (;;) {
      const result = await reader.read();
      if (result.done) break;
      length += result.value.byteLength;
      if (length > 9000) {
        await reader.cancel();
        return new Response(null, { status: 413 });
      }
      chunks.push(result.value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    const payload = JSON.parse(new TextDecoder().decode(bytes));
    if (!payload || Object.keys(payload).some((key) => key !== "token"))
      return new Response(null, { status: 400 });
    token = payload.token;
  } catch {
    return new Response(null, { status: 400 });
  }
  const session =
    typeof token === "string" ? await verifyAdminToken(token) : null;
  if (!session) {
    (await cookies()).delete(adminSessionCookie);
    return new Response(null, { status: 403 });
  }
  (await cookies()).set(adminSessionCookie, token as string, {
    httpOnly: true,
    secure: new URL(request.url).protocol === "https:",
    sameSite: "strict",
    path: "/",
    maxAge: Math.min(3600, Math.floor(session.expiresAt - Date.now() / 1000)),
  });
  return Response.json(
    { uid: session.uid },
    { headers: { "Cache-Control": "no-store" } },
  );
}
export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return new Response(null, { status: 403 });
  (await cookies()).delete(adminSessionCookie);
  return new Response(null, { status: 204 });
}
