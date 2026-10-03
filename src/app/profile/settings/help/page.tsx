import type { Metadata } from "next";
import { SettingsShell } from "@/components/settings/settings-shell";
import { HelpSettings } from "@/components/settings/settings-information";
export const metadata: Metadata = { title: "Help Centre" };
export default function Page() { return <SettingsShell title="Help Centre"><HelpSettings /></SettingsShell>; }
