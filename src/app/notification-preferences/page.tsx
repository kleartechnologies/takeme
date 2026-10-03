import type { Metadata } from "next";
import { PreferencesView } from "@/components/engagement/preferences-view";
import { SettingsShell } from "@/components/settings/settings-shell";
export const metadata: Metadata = { title: "Notifications" };
export default function Page() { return <SettingsShell title="Notifications"><PreferencesView /></SettingsShell>; }
