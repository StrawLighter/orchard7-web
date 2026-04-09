import type { Metadata } from "next";
import "./globals.css";
import WalletProvider from "@/components/WalletProvider";
import Header from "@/components/Header";

export const metadata: Metadata = {
  title: "Orchard 7 — The Gardens",
  description: "Gamified savings protocol on Solana. Stake SOL, earn GrienApple, tend your garden.",
  openGraph: {
    title: "Orchard 7 — The Gardens",
    description: "The roots remember what the world forgot.",
    siteName: "Orchard 7",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-o7-dark text-o7-cream">
        <WalletProvider>
          <Header />
          <main>{children}</main>
        </WalletProvider>
      </body>
    </html>
  );
}
