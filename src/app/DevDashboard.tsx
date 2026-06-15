'use client'
import { useState, useEffect } from 'react'
import { useAccount, useDisconnect } from 'wagmi'

const RPC = 'https://rpc.testnet.arc.network'

async function rpcCall(method: string, params: unknown[] = []) {
  const res = await fetch(RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  })
  const data = await res.json()
  return data.result
}

const hexToNum = (h: string) => parseInt(h, 16)

function timeAgo(ts: number) {
  const d = Math.floor(Date.now() / 1000) - ts
  if (d < 60) return `${d}s ago`
  if (d < 3600) return `${Math.floor(d / 60)}m ago`
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`
  return `${Math.floor(d / 86400)}d ago`
}

interface DevTx {
  hash: string
  block: number
  timestamp: number
  gasUsed: number
  gasCost: number
  type: string
  to: string
}

interface DevStats {
  txCount: number
  totalGasUSDC: number
  contractsDeployed: number
  balance: string
  txs: DevTx[]
}

export function ConnectButton() {
  const { address, isConnected } = useAccount()
  const { disconnect } = useDisconnect()

  if (isConnected && address) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ background: '#0d2b1f', border: '1px solid #1D9E75', borderRadius: 8, padding: '6px 12px', fontSize: 12, color: '#1D9E75', fontFamily: 'monospace' }}>
          {address.slice(0, 6)}...{address.slice(-4)}
        </div>
        <button onClick={() => disconnect()}
          style={{ fontSize: 12, padding: '6px 12px', borderRadius: 8, border: '1px solid #1e1e2e', background: 'transparent', color: '#64748b', cursor: 'pointer' }}>
          Disconnect
        </button>
      </div>
    )
  }

  return (
    <appkit-button label="Connect Wallet" size="sm" />
  )
}

export function DevDashboardTab() {
  const { address, isConnected } = useAccount()
  const [stats, setStats] = useState<DevStats | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!isConnected || !address) return
    loadDevData(address)
  }, [address, isConnected])

  async function loadDevData(addr: string) {
    setLoading(true)
    try {
      // Balance
      const balHex = await rpcCall('eth_getBalance', [addr, 'latest'])
      const balance = (hexToNum(balHex) / 1e6).toFixed(4)

      // Scan last 500 blocks for user transactions
      const latestHex = await rpcCall('eth_blockNumber')
      const latest = hexToNum(latestHex)
      const scanRange = 500
      const step = Math.floor(scanRange / 30)

      const blockNums = Array.from({ length: 30 }, (_, i) =>
        Math.max(0, latest - scanRange + i * step)
      )

      const blocks = await Promise.all(
        blockNums.map(n =>
          rpcCall('eth_getBlockByNumber', ['0x' + n.toString(16), true])
        )
      )

      const txs: DevTx[] = []
      let contractsDeployed = 0
      let totalGas = 0

      for (const block of blocks) {
        if (!block?.transactions) continue
        for (const tx of block.transactions) {
          if (tx.from?.toLowerCase() !== addr.toLowerCase()) continue

          const gasUsed = hexToNum(tx.gas ?? '0x0')
          const gasPrice = hexToNum(tx.gasPrice ?? '0x0') / 1e9
          const gasCost = (gasUsed * gasPrice) / 1e9
          totalGas += gasCost

          const isContract = !tx.to
          if (isContract) contractsDeployed++

          txs.push({
            hash: tx.hash,
            block: hexToNum(block.number),
            timestamp: hexToNum(block.timestamp),
            gasUsed,
            gasCost,
            type: isContract ? '📄 Contract Deploy' : '💸 Transfer',
            to: tx.to ?? 'Contract Creation',
          })
        }
      }

      setStats({
        txCount: txs.length,
        totalGasUSDC: totalGas,
        contractsDeployed,
        balance,
        txs: txs.sort((a, b) => b.timestamp - a.timestamp).slice(0, 15),
      })
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  if (!isConnected) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔗</div>
        <div style={{ fontSize: 18, fontWeight: 600, color: '#f1f5f9', marginBottom: 8 }}>Connect your wallet</div>
        <div style={{ fontSize: 13, color: '#64748b', marginBottom: 24, maxWidth: 400, margin: '0 auto 24px' }}>
          Connect your wallet to see your personal developer dashboard — transactions, contracts deployed, gas spent and more.
        </div>
        <appkit-button label="Connect Wallet" />
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#f1f5f9' }}>Developer Dashboard</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2, fontFamily: 'monospace' }}>{address}</div>
        </div>
        <button onClick={() => address && loadDevData(address)}
          style={{ fontSize: 12, padding: '6px 14px', borderRadius: 8, border: '1px solid #1e1e2e', background: 'transparent', color: '#94a3b8', cursor: 'pointer' }}>
          ↻ Refresh
        </button>
      </div>

      {loading ? (
        <div style={{ fontSize: 13, color: '#475569', textAlign: 'center', padding: '3rem' }}>
          Scanning Arc testnet for your activity...
        </div>
      ) : stats ? (
        <>
          {/* Stats cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: '1.5rem' }}>
            <div style={{ background: '#13131a', border: '1px solid #1e1e2e', borderRadius: 12, padding: '1rem 1.25rem' }}>
              <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>USDC Balance</div>
              <div style={{ fontSize: 24, fontWeight: 600, color: '#1D9E75' }}>{stats.balance}</div>
              <div style={{ fontSize: 12, color: '#475569', marginTop: 3 }}>USDC</div>
            </div>
            <div style={{ background: '#13131a', border: '1px solid #1e1e2e', borderRadius: 12, padding: '1rem 1.25rem' }}>
              <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Transactions</div>
              <div style={{ fontSize: 24, fontWeight: 600, color: '#378ADD' }}>{stats.txCount}</div>
              <div style={{ fontSize: 12, color: '#475569', marginTop: 3 }}>last 500 blocks</div>
            </div>
            <div style={{ background: '#13131a', border: '1px solid #1e1e2e', borderRadius: 12, padding: '1rem 1.25rem' }}>
              <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Contracts Deployed</div>
              <div style={{ fontSize: 24, fontWeight: 600, color: '#A78BFA' }}>{stats.contractsDeployed}</div>
              <div style={{ fontSize: 12, color: '#475569', marginTop: 3 }}>on Arc testnet</div>
            </div>
            <div style={{ background: '#13131a', border: '1px solid #1e1e2e', borderRadius: 12, padding: '1rem 1.25rem' }}>
              <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Gas Spent</div>
              <div style={{ fontSize: 24, fontWeight: 600, color: '#EF9F27' }}>{stats.totalGasUSDC.toFixed(6)}</div>
              <div style={{ fontSize: 12, color: '#475569', marginTop: 3 }}>USDC total</div>
            </div>
          </div>

          {/* Transaction history */}
          <div style={{ background: '#13131a', border: '1px solid #1e1e2e', borderRadius: 12, padding: '1.25rem' }}>
            <div style={{ fontSize: 12, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' }}>
              Recent transactions
            </div>
            {stats.txs.length === 0 ? (
              <div style={{ fontSize: 13, color: '#475569', textAlign: 'center', padding: '2rem' }}>
                No transactions found in the last 500 blocks.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ color: '#475569', fontSize: 11, textTransform: 'uppercase' }}>
                    <th style={{ textAlign: 'left', paddingBottom: 8, fontWeight: 500 }}>Hash</th>
                    <th style={{ textAlign: 'left', paddingBottom: 8, fontWeight: 500 }}>Type</th>
                    <th style={{ textAlign: 'left', paddingBottom: 8, fontWeight: 500 }}>Age</th>
                    <th style={{ textAlign: 'right', paddingBottom: 8, fontWeight: 500 }}>Gas (USDC)</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.txs.map(tx => (
                    <tr key={tx.hash} style={{ borderTop: '1px solid #1e1e2e' }}>
                      <td style={{ padding: '8px 0', color: '#378ADD', fontFamily: 'monospace' }}>
                        <a href={`https://testnet.arcscan.app/tx/${tx.hash}`} target="_blank" rel="noopener noreferrer"
                          style={{ color: '#378ADD', textDecoration: 'none' }}>
                          {tx.hash.slice(0, 8)}...{tx.hash.slice(-6)}
                        </a>
                      </td>
                      <td style={{ padding: '8px 0', color: '#94a3b8' }}>{tx.type}</td>
                      <td style={{ padding: '8px 0', color: '#64748b' }}>{timeAgo(tx.timestamp)}</td>
                      <td style={{ padding: '8px 0', textAlign: 'right', color: '#EF9F27', fontFamily: 'monospace' }}>
                        {tx.gasCost.toFixed(8)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      ) : (
        <div style={{ fontSize: 13, color: '#ef4444', textAlign: 'center', padding: '2rem' }}>
          Failed to load data. Please try refreshing.
        </div>
      )}
    </div>
  )
}
