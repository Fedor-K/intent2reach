import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Intent2Reach - LinkedIn Scraper',
  description: 'LinkedIn scraping service powered by Apify',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="font-sans">{children}</body>
    </html>
  )
}
