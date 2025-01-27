import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Instrument_Serif } from 'next/font/google';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const instrumentSerif = Instrument_Serif({
  weight: ['400'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-instrument-serif',
});

export const metadata: Metadata = {
  title: "The Council - Terminal Chat",
  description: "A terminal-style chat application powered by AI",
  keywords: ["chat", "terminal", "AI", "The Council"],
  authors: [{ name: "The Council" }],
  openGraph: {
    title: "The Council - Terminal Chat", 
    description: "A terminal-style chat application powered by AI",
    url: "https://council.fun",
    siteName: "The Council",
    images: [
      {
        url: "https://council.fun/og-image.png", // You'll need to add this image
        width: 1200,
        height: 630,
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "The Council - Terminal Chat",
    description: "A terminal-style chat application powered by AI",
    creator: "@addaf",
    images: ["https://council.fun/og-image.png"], // You'll need to add this image
  },
  metadataBase: new URL("https://council.fun"),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} antialiased`}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#000000" />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
