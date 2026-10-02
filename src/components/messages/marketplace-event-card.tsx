import Link from "next/link";
import { CheckCircle2, HandCoins } from "lucide-react";
import styles from "./messaging.module.css";

/** A projection of authoritative state, not a fabricated chat message or event log. */
export function MarketplaceEventCard({ title, amount, description, children, href, label }: { title: string; amount: string; description: string; children?: React.ReactNode; href?: string; label?: string }) {
  return <article className={styles.eventCard}><div className={styles.eventHeading}>{title.includes("completed") || title.includes("agreed") ? <CheckCircle2 size={20} /> : <HandCoins size={20} />}<h3>{title}</h3></div><b>{amount}</b><p>{description}</p>{children}{href && <Link className="button-secondary min-h-11 w-full mt-3" href={href}>{label}</Link>}</article>;
}
