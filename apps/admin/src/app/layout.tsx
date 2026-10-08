import type { Metadata } from "next";
import { SessionProvider } from "@admin/components/session";
import "./globals.css";
export const metadata: Metadata = {
  title: { default: "TAKEME Admin", template: "%s | TAKEME Admin" },
  robots: { index: false, follow: false },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
