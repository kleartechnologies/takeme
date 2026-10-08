import "server-only";
import { cookies } from "next/headers";
const COOKIE = "takeme-admin-session";
export const adminSessionCookie = COOKIE;
export async function verifyAdminToken(token: string) {
  if (!token || token.length > 8192) return null;
  const demo = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true";
  const project =
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? (demo ? "demo-takeme" : "");
  if (
    demo
      ? project !== "demo-takeme"
      : !["takeme-52b80", "takeme-staging-822a5"].includes(project)
  )
    return null;
  const endpoint = demo
    ? "http://127.0.0.1:5001/demo-takeme/asia-southeast1/getAdminSession"
    : `https://asia-southeast1-${project}.cloudfunctions.net/getAdminSession`;
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ data: {} }),
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return null;
    const value = (await response.json()).result;
    if (
      !value ||
      typeof value.uid !== "string" ||
      !Number.isFinite(value.expiresAt) ||
      value.expiresAt * 1000 <= Date.now()
    )
      return null;
    return { uid: value.uid, expiresAt: value.expiresAt as number };
  } catch {
    return null;
  }
}
export async function readAdminSession() {
  const token = (await cookies()).get(COOKIE)?.value;
  return token ? verifyAdminToken(token) : null;
}
