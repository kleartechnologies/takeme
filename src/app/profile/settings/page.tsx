import type { Metadata } from "next";
import { AccountSettings } from "@/components/profile/account-settings";
import { SettingsShell } from "@/components/settings/settings-shell";
export const metadata: Metadata = { title: "Settings" };
export default function Page() { return <SettingsShell title="Settings"><AccountSettings /></SettingsShell>; }
