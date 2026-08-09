import type { Metadata } from "next";

import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Expertise Navigator",
    template: "%s | Expertise Navigator",
  },
  description: "Find the right researcher to talk to.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <SiteHeader />
        <div className="siteContent">{children}</div>
        <SiteFooter />
      </body>
    </html>
  );
}
