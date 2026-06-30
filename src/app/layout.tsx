import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Libre_Franklin } from "next/font/google";
import Script from "next/script";
import "react-notion-x/src/styles.css";
import "./globals.css";

const geistSans = Geist({
  display: "swap",
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  display: "swap",
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const libreFranklin = Libre_Franklin({
  display: "swap",
  variable: "--font-libre-franklin",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "NanoHome Ecommerce",
  description: "Modern furniture and design",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

interface RootLayoutProps {
  children: React.ReactNode;
}

function clarityId(): string | null {
  const value = process.env.NEXT_PUBLIC_CLARITY_ID;
  if (value === undefined || value === "clarity_id_placeholder") return null;
  return value;
}

export default function RootLayout({ children }: RootLayoutProps) {
  const clarity = clarityId();

  return (
    <html lang="vi">
      <head>
        {clarity !== null && (
          <Script
            id="microsoft-clarity"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `
                (function(c,l,a,r,i,t,y){
                  c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
                  t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
                  y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
                })(window,document,"clarity","script","${clarity}");
              `,
            }}
          />
        )}
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} ${libreFranklin.variable} antialiased font-[family-name:var(--font-libre-franklin)]`}>
        {children}
      </body>
    </html>
  );
}
