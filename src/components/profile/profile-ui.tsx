import { BadgeCheck, ChevronRight, UserRound } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export function ProfileAvatar({ photo, size = 72 }: { photo?: string | null; size?: number }) {
  return <span className="profile-avatar" style={{ width: size, height: size }}>{photo ? <Image src={photo} alt="" fill sizes={`${size}px`} className="object-cover" /> : <UserRound size={size / 2.5} aria-hidden="true" />}</span>;
}
export function VerifiedLabel({ verified, seller = false }: { verified: boolean; seller?: boolean }) {
  return verified ? <span className="profile-verified"><BadgeCheck size={13} aria-hidden="true" />Verified {seller ? "seller" : "account"}</span> : null;
}
export function ProfileMenuLink({ href, icon, label, detail }: { href: string; icon: React.ReactNode; label: string; detail?: string }) {
  return <Link href={href} className="profile-menu-link"><span aria-hidden="true">{icon}</span><span className="min-w-0 flex-1">{label}</span>{detail && <span className="profile-menu-detail">{detail}</span>}<ChevronRight size={17} aria-hidden="true" /></Link>;
}
export function ProfileEmpty({ title, description }: { title: string; description: string }) {
  return <div className="discovery-empty profile-empty"><Image src="/brand/mascot-2d-happy.png" alt="" width={56} height={48} /><div><h3 className="text-sm font-semibold">{title}</h3><p className="mt-1 text-xs text-[var(--takeme-gray)]">{description}</p></div></div>;
}
