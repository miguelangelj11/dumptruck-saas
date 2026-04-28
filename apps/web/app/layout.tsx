import { Inter } from "next/font/google"
import "@workspace/ui/globals.css"
import { Toaster } from "sonner"
import { NextIntlClientProvider } from "next-intl"
import { getLocale, getMessages } from "next-intl/server"

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" })

export const metadata = {
  title: "DumpTruckBoss — Run Your Business Smarter",
  description: "DumpTruckBoss helps you manage tickets, dispatch drivers, send invoices, and track revenue — all in one place.",
  manifest: "/manifest.json",
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale()
  const messages = await getMessages()

  return (
    <html lang={locale} suppressHydrationWarning className={inter.variable}>
      <body className="bg-white font-sans antialiased">
        <NextIntlClientProvider messages={messages}>
          {children}
          <Toaster position="top-right" richColors />
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
