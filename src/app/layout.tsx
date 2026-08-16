import type { Metadata } from 'next'
import './globals.css'
import { SURFACES, TEXT } from '@/lib/theme'

export const metadata: Metadata = {
  title: 'ArcPulse — Arc Testnet Health Monitor',
  description: 'Real-time network health dashboard for the Arc blockchain testnet.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ background: SURFACES.BG, color: TEXT.DEFAULT }}>{children}</body>
    </html>
  )
}
