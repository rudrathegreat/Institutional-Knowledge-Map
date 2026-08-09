import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Expertise Navigator",
  description: "Find the right researcher to talk to.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
