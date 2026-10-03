import type { Metadata } from "next";
import { Suspense } from "react";
import { SavedView, SavedSkeleton } from "@/components/saved/saved-view";
import styles from "@/components/saved/saved.module.css";

export const metadata: Metadata = { title: "Saved", description: "Your saved items, auctions, followed sellers and searches.", robots: { index: false, follow: false } };
export default function SavedPage() { return <main className={styles.page}><Suspense fallback={<SavedSkeleton />}><SavedView /></Suspense></main>; }
