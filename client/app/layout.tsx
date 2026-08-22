import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { RegisterServiceWorker } from "@/components/RegisterServiceWorker";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const isDev = process.env.NODE_ENV !== "production";

export const metadata: Metadata = {
  title: isDev ? "Life Plan (Dev)" : "Life Plan",
  description: "Life Plan Application",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: isDev ? "/icon-192-dev.png" : "/icon-192.png",
    shortcut: "/icon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#2563eb",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const root = document.documentElement;
                  // Always remove dark class first to ensure light mode default
                  root.classList.remove('dark');
                  // Then check localStorage and apply if needed
                  const stored = localStorage.getItem('theme');
                  if (stored === 'dark') {
                    root.classList.add('dark');
                  } else {
                    // Explicitly ensure light mode
                    root.classList.remove('dark');
                    // Set to light if not set or invalid
                    if (!stored || (stored !== 'light' && stored !== 'dark')) {
                      localStorage.setItem('theme', 'light');
                    }
                  }
                } catch (e) {
                  // If localStorage fails, default to light
                  document.documentElement.classList.remove('dark');
                }
              })();
            `,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <RegisterServiceWorker />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
