import { Inter } from "next/font/google"
import "@workspace/ui/globals.css"
import { Toaster } from "sonner"
import { NextIntlClientProvider } from "next-intl"
import { getLocale, getMessages } from "next-intl/server"
import { RegisterSW } from "@/components/pwa/RegisterSW"
import { Suspense } from "react"
import { PostHogProvider } from "@/components/analytics/PostHogProvider"

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" })

export const metadata = {
  title: "DumpTruckBoss — Run Your Business Smarter",
  description: "DumpTruckBoss helps you manage tickets, dispatch drivers, send invoices, and track revenue — all in one place.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "DumpTruckBoss",
  },
  applicationName: "DumpTruckBoss",
  formatDetection: { telephone: false },
  themeColor: "#F5B731",
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png" },
      { url: "/icons/icon-152x152.png", sizes: "152x152", type: "image/png" },
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
    ],
  },
}

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#F5B731",
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale()
  const messages = await getMessages()

  return (
    <html lang={locale} suppressHydrationWarning className={inter.variable}>
      <head>
        {/* iOS PWA splash screens */}
        <link rel="apple-touch-startup-image"
          media="(device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2)"
          href="/splash/splash-640x1136.png" />
        <link rel="apple-touch-startup-image"
          media="(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2)"
          href="/splash/splash-750x1334.png" />
        <link rel="apple-touch-startup-image"
          media="(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)"
          href="/splash/splash-1170x2532.png" />
        <link rel="apple-touch-startup-image"
          media="(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3)"
          href="/splash/splash-1284x2778.png" />
        <link rel="apple-touch-startup-image"
          media="(device-width: 768px) and (device-height: 1024px) and (-webkit-device-pixel-ratio: 2)"
          href="/splash/splash-1536x2048.png" />
        <link rel="apple-touch-startup-image"
          media="(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2)"
          href="/splash/splash-2048x2732.png" />
        {/* Windows tile */}
        <meta name="msapplication-TileColor" content="#1a1a1a" />
        <meta name="msapplication-TileImage" content="/icons/icon-144x144.png" />
        <meta name="msapplication-tap-highlight" content="no" />
        {/* Android */}
        <meta name="mobile-web-app-capable" content="yes" />
        {/* iOS — Next.js 16 metadata API renders appleWebApp.capable as mobile-web-app-capable; add this manually */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body className="bg-white font-sans antialiased">
        <NextIntlClientProvider messages={messages}>
          <Suspense fallback={null}>
            <PostHogProvider>
              {children}
              <Toaster position="top-right" richColors />
              <RegisterSW />
            </PostHogProvider>
          </Suspense>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
