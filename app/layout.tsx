import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Noto_Sans } from "next/font/google";
// Elah ships three stylesheets and needs all of them, in this order.
import "@elah/timeline/styles.css";
import "@elah/editor/styles.css";
import "@elah/editor/styles/tokens.css";
import "./globals.css";

const heading = Bricolage_Grotesque({ variable: "--font-heading", subsets: ["latin"] });
const body = Noto_Sans({ variable: "--font-body", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "StepCut",
  description: "Turn a phone screen recording into a captioned step-by-step tutorial.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0B0B0C",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${heading.variable} ${body.variable} antialiased`}>
      <body>{children}</body>
    </html>
  );
}
