import type { Metadata, Viewport } from "next";
import { Libre_Franklin, Noto_Sans_KR } from "next/font/google";
import { TrackingProvider } from "@/components/analytics/tracking-provider";
import { getLocalizedMetadata, SITE_NAME, SITE_URL } from "@/lib/site-metadata";
import "./globals.css";

const libreFranklin = Libre_Franklin({
  display: "swap",
  variable: "--font-libre-franklin",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
});

const notoSansKr = Noto_Sans_KR({
  display: "swap",
  preload: false,
  variable: "--font-noto-sans-kr",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const defaultMetadata = getLocalizedMetadata("vi");

export const metadata: Metadata = {
  ...defaultMetadata,
  metadataBase: new URL(SITE_URL),
  applicationName: SITE_NAME,
  title: {
    default: `${SITE_NAME} | Nội thất thiết kế chính hãng`,
    template: `%s | ${SITE_NAME}`,
  },
  keywords: [
    "nanoHome",
    "nội thất thiết kế",
    "nội thất chính hãng",
    "designer furniture",
    "Cassina",
    "B&B Italia",
    "Maxalto",
  ],
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  referrer: "origin-when-cross-origin",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  category: "furniture",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  colorScheme: "light",
  themeColor: "#ffffff",
};

interface RootLayoutProps {
  children: React.ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="vi">
      <head />
      <body className={`${libreFranklin.variable} ${notoSansKr.variable} antialiased font-[family-name:var(--font-libre-franklin)]`}>
        {children}
        <TrackingProvider />
      </body>
    </html>
  );
}
