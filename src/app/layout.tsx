import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import { AuthProvider } from "@/components/auth/auth-provider";
import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { MobileNav } from "@/components/layout/mobile-nav";
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
  return <html lang="en" data-scroll-behavior="smooth" className={`${poppins.variable} h-full antialiased`}><body className="min-h-full"><AuthProvider><Header />{children}<Footer /><MobileNav /></AuthProvider></body></html>;
}
