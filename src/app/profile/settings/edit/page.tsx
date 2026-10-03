import type { Metadata } from "next";
import { SettingsShell } from "@/components/settings/settings-shell";
import { EditProfileSettings } from "@/components/settings/edit-profile-settings";
export const metadata: Metadata = { title: "Edit profile" };
export default function Page() { return <SettingsShell title="Edit profile"><EditProfileSettings /></SettingsShell>; }
