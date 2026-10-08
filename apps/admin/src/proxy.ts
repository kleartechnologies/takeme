import { NextResponse } from "next/server";
// Explicit isolated proxy; never inherit the consumer legal-publication proxy.
export function proxy() {
  return NextResponse.next();
}
