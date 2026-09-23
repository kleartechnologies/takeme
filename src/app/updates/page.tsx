import type { Metadata } from "next";
import { Bell } from "lucide-react";
import { UpdatesView } from "@/components/updates/updates-view";

export const metadata: Metadata = { title: "Updates", description: "Real marketplace activity and transactions that need your attention." };

export default function UpdatesPage() {
  return <main className="page-shell min-h-[70vh] py-6 pb-28 md:py-10 lg:pb-16"><div className="mb-6 flex items-start gap-3"><span className="mt-1 grid size-11 shrink-0 place-items-center rounded-full bg-[var(--takeme-light-green)] text-[var(--takeme-dark-green)]"><Bell size={21} /></span><div><p className="eyebrow">Marketplace inbox</p><h1 className="mt-1 text-3xl font-bold tracking-[-0.04em] sm:text-4xl">Updates</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--takeme-gray)]">Your real TAKEME activity, with action items first.</p></div></div><UpdatesView /></main>;
}
