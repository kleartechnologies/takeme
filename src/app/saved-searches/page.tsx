import type { Metadata } from "next";
import { SavedSearchesView } from "@/components/engagement/saved-searches-view";
export const metadata: Metadata = { title: "Saved Searches" };
export default function Page() { return <main className="page-shell min-h-[70vh] py-7 pb-28 lg:pb-16"><h1 className="mb-2 text-3xl font-bold">Saved searches</h1><SavedSearchesView /></main>; }
