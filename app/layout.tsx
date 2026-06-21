import type { Metadata } from "next";
import { Inter, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "EcoTrace 🇮🇳 — Your Carbon Footprint, Made Visible",
  description: "Know your carbon footprint in 60 seconds — then start shrinking it. Track emissions across transport, energy, diet, and waste, and save your history.",
  metadataBase: new URL("http://localhost:3000"),
  openGraph: {
    title: "EcoTrace 🇮🇳 — Carbon Footprint awareness",
    description: "Measure, understand, and reduce your environmental footprint.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-mist text-graphite font-sans">
        {children}
      </body>
    </html>
  );
}
