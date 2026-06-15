import { createAppKit } from '@reown/appkit/react'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { defineChain } from 'viem'

export const arcTestnet = defineChain({
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 6 },
  rpcUrls: {
    default: { http: ['https://rpc.testnet.arc.network'] },
  },
  blockExplorers: {
    default: { name: 'ArcScan', url: 'https://testnet.arcscan.app' },
  },
  testnet: true,
})

const projectId = 'c8b83e95a6c30b9c89036636ee029c26'

export const wagmiAdapter = new WagmiAdapter({
  networks: [arcTestnet],
  projectId,
})

export const modal = createAppKit({
  adapters: [wagmiAdapter],
  networks: [arcTestnet],
  projectId,
  metadata: {
    name: 'ArcPulse',
    description: 'Arc Testnet Network Health Monitor',
    url: 'https://arcpulse-self.vercel.app',
    icons: ['https://arcpulse-self.vercel.app/Arc_Logo.png'],
  },
  features: {
    analytics: false,
    email: false,
    socials: false,
  },
  themeMode: 'dark',
  themeVariables: {
    '--w3m-accent': '#1D9E75',
    '--w3m-border-radius-master': '8px',
  },
})
