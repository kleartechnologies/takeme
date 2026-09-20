import type { Metadata } from "next";
import Link from "next/link";
import { TierGuide } from "@/components/profile/tier-guide";

export const metadata: Metadata = { title: "How TAKEME tiers work" };
export default function TierHelpPage() {
  return <main className="page-shell py-8 md:py-12"><div className="mx-auto max-w-3xl"><Link href="/profile" className="inline-flex min-h-11 items-center text-sm font-semibold text-[var(--takeme-dark-green)]">← Back to profile</Link><h1 className="page-title mt-3">How TAKEME tiers work</h1><TierGuide /></div></main>;
}
