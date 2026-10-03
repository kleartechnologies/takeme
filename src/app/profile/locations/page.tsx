import type { Metadata } from "next";
import { LocationsSettings } from "@/components/profile/locations-settings";
import { SettingsShell } from "@/components/settings/settings-shell";
export const metadata: Metadata = { title: "Addresses & meet-up" };
export default function Page() { return <SettingsShell title="Addresses & meet-up"><LocationsSettings /></SettingsShell>; }
