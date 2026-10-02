import type { Metadata } from "next";
import { AccountSettings } from "@/components/profile/account-settings";
export const metadata: Metadata = { title: "Settings & account" };
export default function SettingsPage() { return <main className="page-shell profile-system"><AccountSettings /></main>; }
