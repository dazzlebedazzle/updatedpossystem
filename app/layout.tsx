import type { Metadata } from "next";
import type { CSSProperties } from "react";
import "./globals.css";
import ToastProvider from "@/components/ToastProvider";

export const metadata: Metadata = {
  title: "POS System",
  description: "Point of Sale System with Role-Based Access Control",
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 5,
  },
  // Add performance hints
  other: {
    "theme-color": "#ffffff",
  },
  // Resource hints for better performance
  icons: {
    icon: '/favicon.ico',
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
        className="antialiased"
        style={{
          "--font-geist-sans": "system-ui, Arial, sans-serif",
          "--font-geist-mono": "Consolas, 'Courier New', monospace",
        } as CSSProperties}
        suppressHydrationWarning={true}
      >
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
