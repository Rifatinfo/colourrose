import type { Metadata } from "next";
import {
  Geist,
  Geist_Mono,
  Inter,
  Playfair_Display,
  Source_Serif_4,
} from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Providers } from "@/components/providers/Providers";
import { SmoothScroll } from "@/components/providers/SmoothScroll";
import { CookieConsent } from "@/components/modules/CookieConsent/CookieConsent";

const inter = Inter({subsets:['latin'],variable:'--font-sans'});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Editorial faces for the Stories pages: a high-contrast display serif for
// the wordmark and headlines, a text serif for long-form reading.
const displaySerif = Playfair_Display({
  variable: "--font-display-serif",
  subsets: ["latin"],
  display: "swap",
});

const bodySerif = Source_Serif_4({
  variable: "--font-body-serif",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Windrise Admin",
  description: "Windrise store administration dashboard",
  // The admin app is never a search result; keeping it out of indexes also
  // stops the login page showing up under the storefront's brand.
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn(
        "h-full",
        "antialiased",
        geistSans.variable,
        geistMono.variable,
        "font-sans",
        inter.variable,
        displaySerif.variable,
        bodySerif.variable
      )}
    >
      {/* Browser extensions (Grammarly, password managers…) add attributes to
          <body> before React loads. This ignores those attribute differences on
          this element only; mismatches in the page itself are still reported. */}
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {/*
          Mounted at the root so one instance covers every route — header,
          hero, product grids, blog, footer, dashboard. It renders nothing and
          holds no state; putting it inside a section would scope the effect
          to that section and a second instance would fight the first.
        */}
        <SmoothScroll />
        <Providers>{children}</Providers>
        <CookieConsent />
      </body>
    </html>
  );
}
