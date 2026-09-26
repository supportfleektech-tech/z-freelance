import type { Metadata } from "next";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: {
    template: "%s · z-freelance",
    default: "z-freelance — hire freelancers with money held in escrow",
  },
  description:
    "z-freelance is a freelance marketplace with milestone escrow: clients fund work in advance, freelancers get paid the moment their delivery is approved.",
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
  applicationName: "z-freelance",
  openGraph: {
    type: "website",
    siteName: "z-freelance",
    title: "z-freelance — hire freelancers with money held in escrow",
    description:
      "A freelance marketplace with milestone escrow: fund work in advance, release payment the moment delivery is approved.",
  },
  twitter: {
    card: "summary",
    title: "z-freelance — milestone-escrow freelance marketplace",
    description:
      "Clients fund work in advance; freelancers get paid the moment delivery is approved.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col">
        <SiteHeader />
        <div className="flex-1">{children}</div>
        <SiteFooter />
      </body>
    </html>
  );
}
