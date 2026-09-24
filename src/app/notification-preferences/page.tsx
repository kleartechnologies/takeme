import type { Metadata } from "next";
import { PreferencesView } from "@/components/engagement/preferences-view";
export const metadata: Metadata = { title: "Notification Preferences" };
export default function Page() { return <main className="page-shell min-h-[70vh] py-7 pb-28 lg:pb-16"><h1 className="mb-5 text-3xl font-bold">Notification preferences</h1><PreferencesView /></main>; }
