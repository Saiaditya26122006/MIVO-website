import type { Metadata } from "next";
import { Inter, Caveat } from "next/font/google";
import "./globals.css";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

const caveat = Caveat({
  subsets: ["latin"],
  variable: "--font-handwritten",
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "MIVO — Making Ideas into Visible Objects",
  description: "Premium 3D printing and custom fabrication services. Transform your ideas into physical reality with MIVO's expert 3D printing solutions.",
  keywords: ["3D printing", "custom fabrication", "3D models", "rapid prototyping"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${caveat.variable}`}>
      <body className="min-h-screen flex flex-col bg-cream text-ink antialiased">
        <Navigation />
        <main className="flex-1 pt-16">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
