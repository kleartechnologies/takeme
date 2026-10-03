import type { Metadata } from "next";
import { SettingsShell } from "@/components/settings/settings-shell";
import { SecuritySettings } from "@/components/settings/security-settings";
export const metadata: Metadata = { title: "Security" };
export default function Page() { return <SettingsShell title="Security"><SecuritySettings /></SettingsShell>; }
