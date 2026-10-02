import { ArrowRight, type LucideIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export function DiscoverySectionHeader({ id, title, subtitle, href, icon: Icon }: { id: string; title: string; subtitle: string; href?: string; icon?: LucideIcon }) {
  return <div className="discovery-section-header"><div><h2 id={id} className="discovery-section-title">{Icon && <Icon size={21} aria-hidden="true" />}{title}</h2><p className="discovery-section-subtitle">{subtitle}</p></div>{href && <Link href={href} className="discovery-see-all">See all <ArrowRight size={15} aria-hidden="true" /></Link>}</div>;
}

export function DiscoveryEmptyState({ title, description, action, href }: { title: string; description: string; action: string; href: string }) {
  return <div className="discovery-empty"><Image src="/brand/mascot-2d-happy.png" alt="" width={64} height={54} /><div><p className="text-sm font-semibold">{title}</p><p className="mt-1 text-xs text-[var(--takeme-gray)]">{description}</p><Link href={href} className="discovery-see-all mt-1">{action}<ArrowRight size={14} aria-hidden="true" /></Link></div></div>;
}
