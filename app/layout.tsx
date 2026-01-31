import type { Metadata, Viewport } from "next";
import { Special_Elite, JetBrains_Mono, VT323, Courier_Prime } from "next/font/google";
import "./globals.css";
import { AudioProvider } from "@/components/layout/AudioProvider";
import { Footer } from "@/components/layout/Footer";
import { SessionProvider } from "@/components/providers/SessionProvider";

const specialElite = Special_Elite({
  weight: "400",
  variable: "--font-special-elite",
  subsets: ["latin"],
});

const courierPrime = Courier_Prime({
  weight: "400",
  variable: "--font-courier-prime",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

const vt323 = VT323({
  weight: "400",
  variable: "--font-vt323",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#7f1d1d",
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  title: {
    default: "Detective Mongo D. Bane | Code Crime Unit",
    template: "%s | Detective Mongo D. Bane",
  },
  description: "Uncover the truth hidden in your codebase. Transform any GitHub repository into a gripping True Crime audio investigation. Analyze commits, interrogate spaghetti code, and reveal the architectural mysteries.",
  openGraph: {
    title: "Detective Mongo D. Bane | Code Crime Unit",
    description: "Uncover the truth hidden in your codebase. Transform any GitHub repository into a gripping True Crime audio investigation.",
    url: "/",
    siteName: "Detective Mongo D. Bane",
    images: [
      {
        url: "/og.jpeg",
        width: 1200,
        height: 630,
        alt: "Detective Mongo D. Bane - Code Crime Unit Investigation Board",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Detective Mongo D. Bane | Code Crime Unit",
    description: "Uncover the truth hidden in your codebase. Transform any GitHub repository into a gripping True Crime audio investigation.",
    images: ["/og.jpeg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${specialElite.variable} ${jetbrainsMono.variable} ${vt323.variable} ${courierPrime.variable} antialiased bg-[#050505] text-[#e7e5e4] flex flex-col min-h-screen`}
        suppressHydrationWarning
      >
        {/* Global Film Grain Overlay */}
        <div className="fixed inset-0 pointer-events-none z-[9999] opacity-[0.05] mix-blend-overlay bg-[url('/grain.gif')]"></div>
        
        <SessionProvider>
          <AudioProvider>
            <main className="flex-1 flex flex-col">
              {children}
            </main>
            <Footer />
          </AudioProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
