import type { Metadata } from "next";
import { ForYouFeed } from "@/components/intelligence/for-you-feed";

export const metadata: Metadata = { title: "For You", description: "Marketplace recommendations shaped by your real TAKEME activity." };

export default function ForYouPage() {
  return <main className="page-shell min-h-[70vh] py-6 pb-28 md:py-10 lg:pb-16"><div className="mb-6"><p className="eyebrow">Your marketplace</p><h1 className="mt-1 text-3xl font-bold tracking-[-0.04em] sm:text-4xl">For You</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--takeme-gray)]">Useful recommendations, shaped by what you actually explore on TAKEME.</p></div><ForYouFeed /></main>;
}
