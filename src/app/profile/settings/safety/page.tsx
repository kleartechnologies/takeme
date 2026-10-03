import type { Metadata } from "next";
import { SettingsShell } from "@/components/settings/settings-shell";
import { SafetySettings } from "@/components/settings/settings-information";
export const metadata: Metadata = { title: "Safety" };
export default function Page() { return <SettingsShell title="Safety"><SafetySettings /></SettingsShell>; }
