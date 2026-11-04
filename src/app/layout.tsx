import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import { AccountSync } from "@/components/account/AccountSync";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { CartProvider } from "@/components/cart/CartProvider";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { PromoStrip } from "@/components/layout/PromoStrip";
import { WhatsAppButton } from "@/components/layout/WhatsAppButton";
import { getSiteUrl } from "@/lib/seo/site-url";
import { siteConfig } from "@/lib/site";
import "./globals.css";

const dmSans = DM_Sans({ variable: "--font-dm-sans", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: { default: siteConfig.name, template: `%s | ${siteConfig.name}` },
  description: siteConfig.tagline,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-IN" className={`${dmSans.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <a
          href="#main"
          className="focus:bg-background sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:p-2"
        >
          Skip to content
        </a>
        <CartProvider>
          <AccountSync />
          <PromoStrip />
          <Header />
          <div id="main" className="flex-1">
            {children}
          </div>
          <Footer />
          <WhatsAppButton />
          <CartDrawer />
        </CartProvider>
      </body>
    </html>
  );
}
