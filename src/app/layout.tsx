import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'ArcPulse — Arc Testnet Health Monitor',
  description: 'Real-time network health dashboard for the Arc blockchain testnet. Monitoring gas, block time, RPC latency and network activity.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
