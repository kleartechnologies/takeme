import Link from "next/link";
import { Logo } from "./logo";

export function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-[var(--takeme-charcoal)] pb-24 pt-12 text-gray-300 md:pb-10">
      <div className="page-shell grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <div className="inline-flex rounded-xl bg-white p-1.5"><Logo compact /></div>
          <p className="mt-4 max-w-sm text-sm font-semibold text-white">Same Stuff. A Brighter Tomorrow.</p>
          <p className="mt-1 max-w-sm text-sm leading-6 text-gray-400">Buy. Sell. Give. Reuse.</p>
        </div>
        <div>
          <p className="text-sm font-bold text-white">Marketplace</p>
          <div className="mt-3 grid gap-2 text-sm"><Link href="/explore">Explore</Link><Link href="/sell">Sell an item</Link><Link href="/profile">Your profile</Link></div>
        </div>
        <div>
          <p className="text-sm font-bold text-white">Marketplace status</p>
          <p className="mt-3 text-sm leading-6 text-gray-400">Real seller listings are live when Firebase is connected. Checkout and bidding are not available yet.</p>
        </div>
      </div>
    </footer>
  );
}
