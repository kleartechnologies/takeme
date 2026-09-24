import type { Metadata } from "next";
import { FollowingView } from "@/components/engagement/following-view";
export const metadata: Metadata = { title: "Following" };
export default function Page() { return <main className="page-shell min-h-[70vh] py-7 pb-28 lg:pb-16"><h1 className="mb-2 text-3xl font-bold">Following</h1><p className="mb-5 text-sm text-[var(--takeme-gray)]">Sellers whose new listings you want to hear about.</p><FollowingView /></main>; }
