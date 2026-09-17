import type { Metadata } from "next";
import { Space_Grotesk, Sora, Playfair_Display } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";
import "./styles/flightone-visual.css";
import "./styles/flightone-platform.css";
import "./styles/flightone-ui.css";
import "./styles/flightone-traveller.css";
import "./styles/flightone-results-responsive.css";
import "./styles/flightone-chat-layout.css";
import "./styles/flightone-chat-responsive.css";
import "./styles/flightone-chat-landing.css";
import "./styles/flightone-desk.css";
import "./styles/flightone-groups-mice.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  display: "swap",
});

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  weight: "700",
  display: "swap",
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "FlightOne — Travel Consultant",
  description:
    "Describe your trip in plain language. FlightOne searches live flights and stays, then presents clear options to compare.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${sora.variable} ${playfair.variable} w-full antialiased`}
    >
      <body className="flex min-h-[100dvh] min-w-0 w-full max-w-full flex-col font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
