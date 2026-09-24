import type { Metadata } from "next";
import { Bell } from "lucide-react";
import { NotificationsCenter } from "@/components/updates/notifications-center";

export const metadata: Metadata = { title: "Updates", description: "Your real marketplace notifications and alerts." };

export default function UpdatesPage() {
  return <main className="page-shell min-h-[70vh] py-6 pb-28 md:py-10 lg:pb-16"><div className="mb-6 flex items-start gap-3"><span className="mt-1 grid size-11 shrink-0 place-items-center rounded-full bg-[var(--takeme-light-green)] text-[var(--takeme-dark-green)]"><Bell size={21} /></span><div><p className="eyebrow">Marketplace inbox</p><h1 className="mt-1 text-3xl font-bold tracking-[-0.04em] sm:text-4xl">Updates</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--takeme-gray)]">Real marketplace alerts, newest first.</p></div></div><NotificationsCenter /></main>;
}
