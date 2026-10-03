"use client";
import { Bell, ChevronLeft, HelpCircle, LogOut, Trash2, MapPin } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { EditProfile } from "@/components/profile/edit-profile";
import { ProfileMenuLink } from "@/components/profile/profile-ui";
import { getUserProfile } from "@/lib/services/users";
import { logout } from "@/lib/firebase/auth";
import type { UserProfile } from "@/types/marketplace";

export function AccountSettings() {
  const { user, loading } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { if (!user) return; let active = true; getUserProfile(user.uid).then((value) => { if (active) setProfile(value); }).catch(() => { if (active) setError("Profile settings could not be loaded."); }); return () => { active = false; }; }, [user]);
  return <div><div className="profile-page-title"><Link href="/profile" className="icon-button" aria-label="Back to your profile"><ChevronLeft size={21} /></Link><h1>Settings & account</h1></div>{loading ? <p role="status">Loading account…</p> : !user ? <Link href="/login?next=/profile/settings" className="button-primary min-h-11 px-5">Log in</Link> : <><section className="profile-settings-card"><h2>Account information</h2><p className="mt-2 break-words text-sm text-[var(--takeme-gray)]">{user.email}</p><p className="mt-1 text-xs text-[var(--takeme-gray)]">Your email is private account information.</p>{profile && profile.uid === user.uid && <EditProfile key={profile.updatedAt} profile={profile} onSaved={setProfile} />}{error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}</section><div className="profile-menu mt-4"><ProfileMenuLink href="/profile/locations" label="Addresses & Meetup Locations" icon={<MapPin size={19} />} /><ProfileMenuLink href="/notification-preferences" label="Notification preferences" icon={<Bell size={19} />} /><ProfileMenuLink href="/help/tiers" label="Help with TAKEME tiers" icon={<HelpCircle size={19} />} /><ProfileMenuLink href="/account-deletion" label="Delete account" icon={<Trash2 size={19} />} /><button type="button" onClick={() => void logout()} className="profile-menu-link"><LogOut size={19} aria-hidden="true" />Sign out</button></div></>}</div>;
}
