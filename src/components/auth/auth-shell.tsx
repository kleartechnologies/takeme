import { ArrowLeft, Leaf } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/layout/logo";
import styles from "./auth.module.css";

export function AuthShell({ children }: { children: React.ReactNode }) {
  return <main className={styles.shell}>
    <div className={styles.top}><Logo compact /><Link href="/explore"><ArrowLeft size={16} /> Back to marketplace</Link></div>
    <div className={styles.layout}>
      <aside className={styles.brand}><p className={styles.eyebrow}>Same stuff. A brighter tomorrow.</p><h2>Something worth<br />taking home.</h2><p>Discover new, branded and preloved finds.<br />Buy, sell and explore auctions on TAKEME.</p><div className={styles.brandNote}><Leaf size={20} /><span>Great things find new homes.</span></div></aside>
      <div className={styles.card}>{children}</div>
    </div>
    <p className={styles.footer}>TAKEME TECHNOLOGIES · Buy. Sell. Give. Reuse.</p>
  </main>;
}
