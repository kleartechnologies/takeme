import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import { Suspense } from "react";
import { AuthProvider } from "@/components/auth/auth-provider";
import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { MobileNav } from "@/components/layout/mobile-nav";
import { UnreadCountProvider } from "@/lib/use-unread-count";
import { isStagingReleaseProof } from "@/lib/release-proof";
import "./globals.css";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");

export const metadata: Metadata = {
  ...(isStagingReleaseProof(process.env.TAKEME_BUILD_RELEASE_PROOF) ? { robots: { index: false, follow: false } } : {}),
  metadataBase: new URL(siteUrl),
  title: { default: "TAKEME — Same Stuff. A Brighter Tomorrow.", template: "%s | TAKEME" },
  description: "Buy. Sell. Give. Reuse. A modern peer-to-peer marketplace for Malaysia.",
  applicationName: "TAKEME",
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: "TAKEME — Same Stuff. A Brighter Tomorrow.",
    description: "Buy. Sell. Give. Reuse.",
    siteName: "TAKEME",
    locale: "en_MY",
    type: "website",
    images: [{ url: "/brand/takeme-app-icon.png", width: 1080, height: 1080, alt: "TAKEME app icon" }],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return <html lang="en" data-scroll-behavior="smooth" className={`${poppins.variable} h-full antialiased`}><body className="min-h-full">{isStagingReleaseProof(process.env.TAKEME_BUILD_RELEASE_PROOF) && <div className="bg-amber-50 px-4 py-2 text-center text-xs font-medium text-amber-950" role="note">STAGING · Test accounts and synthetic data only. Policies are test drafts.</div>}<AuthProvider><UnreadCountProvider><Header />{children}<Footer /><Suspense fallback={null}><MobileNav /></Suspense></UnreadCountProvider></AuthProvider></body></html>;
}
