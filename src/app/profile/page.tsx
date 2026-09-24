import type { Metadata } from "next";
import { ProfileView } from "@/components/profile/profile-view";
export const metadata: Metadata = { title: "Your profile", robots: { index: false, follow: false } };
export default function ProfilePage() { return <main className="page-shell py-8 md:py-12"><ProfileView /></main>; }
