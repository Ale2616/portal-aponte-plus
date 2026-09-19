import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { branding } from "@/config/branding";
import { ConfigProvider } from "@/context/ConfigContext";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: `${branding.companyName} - Portal Clientes`,
  description: `Consulta tu estado de cuenta, descarga tus facturas y reporta tus pagos en línea de forma inmediata con ${branding.companyName}.`,
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Aponte Plus",
    startupImage: ["/icons/icon-512x512.png"],
  },
  icons: {
    icon: [
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning className="overflow-x-hidden w-full max-w-full">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0f172a" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Aponte Plus" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased min-h-[100dvh] flex flex-col overflow-x-hidden w-full max-w-full`}
      >
        <ConfigProvider>
          <ServiceWorkerRegister />
          <Toaster
            position="bottom-center"
            duration={3000}
            richColors
            closeButton
            toastOptions={{
              duration: 3000,
              className: "pointer-events-auto",
              style: {
                borderRadius: "1rem",
                fontSize: "0.875rem",
              },
            }}
          />
          {children}
        </ConfigProvider>
      </body>
    </html>
  );
}
