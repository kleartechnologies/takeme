import type { Metadata } from "next";
import { SettingsShell } from "@/components/settings/settings-shell";
import { PrivacySettings } from "@/components/settings/settings-information";
export const metadata: Metadata = { title: "Privacy" };
export default function Page() { return <SettingsShell title="Privacy"><PrivacySettings /></SettingsShell>; }
