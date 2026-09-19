import type { Metadata } from "next";
import { SavedView } from "@/components/saved/saved-view";

export const metadata: Metadata = { title: "Saved listings | TAKEME", description: "Your saved marketplace discoveries." };
export default function SavedPage() { return <main className="page-shell min-h-[70vh] py-6 pb-28 lg:py-10"><SavedView /></main>; }
