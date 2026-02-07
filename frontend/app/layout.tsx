import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import './globals.css'

export const metadata: Metadata = {
  title: 'QA-QC',
  description: 'Construction specbook ingestion and trade-specific rule extraction',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistSans.className}`}>
      <body className="antialiased bg-gray-100 min-h-screen">{children}</body>
    </html>
  )
}
