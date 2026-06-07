'use client'
import { useArcData } from './useArcData'
import { useState } from 'react'
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'

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

interface WalletTx {
  hash: string
  block: number
  timestamp: number
  gas: number
  gasPrice: number
  gasCost: number
  hour: number
  to: string
  value: number
}

function timeAgo(ts: number) {
  const d = Math.floor(Date.now() / 1000) - ts
  if (d < 60) return `${d}s ago`
  if (d < 3600) return `${Math.floor(d / 60)}m ago`
  return `${Math.floor(d / 3600)}h ago`
}

function MetricCard({ label, value, unit, color = '#1D9E75' }: {
  label: string; value: string | number; unit: string; color?: string
}) {
  return (
    <div style={{ background: '#13131a', border: '1px solid #1e1e2e', borderRadius: 12, padding: '1rem 1.25rem' }}>
      <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 600, color }}>{value}</div>
      <div style={{ fontSize: 12, color: '#475569', marginTop: 3 }}>{unit}</div>
    </div>
  )
}

const chartTooltipStyle = {
  contentStyle: { background: '#13131a', border: '1px solid #1e1e2e', borderRadius: 8, fontSize: 12 },
  labelStyle: { color: '#94a3b8' },
}

function WalletLookup() {
  const [address, setAddress] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [txs, setTxs] = useState<WalletTx[]>([])
  const [balance, setBalance] = useState<string | null>(null)
  const [searched, setSearched] = useState(false)

  async function lookup() {
    const addr = address.trim()
    if (!addr.startsWith('0x') || addr.length !== 42) {
      setError('Enter a valid wallet address (0x...)')
      return
    }
    setLoading(true)
    setError('')
    setTxs([])
    setBalance(null)
    setSearched(false)

    try {
      // Get balance
      const balHex = await rpcCall('eth_getBalance', [addr, 'latest'])
      const balUSDC = (hexToNum(balHex) / 1e6).toFixed(4)
      setBalance(balUSDC)

      // Get latest block
      const latestHex = await rpcCall('eth_blockNumber')
      const latest = hexToNum(latestHex)

      // Scan last 200 blocks for transactions
      const scanRange = 200
      const startBlock = Math.max(0, latest - scanRange)
      const blockNums = Array.from({ length: Math.min(scanRange, 50) }, (_, i) =>
        startBlock + Math.floor(i * scanRange / 50)
      )

      const blocks = await Promise.all(
        blockNums.map(n =>
          rpcCall('eth_getBlockByNumber', ['0x' + n.toString(16), true])
        )
      )

      const found: WalletTx[] = []
      for (const block of blocks) {
        if (!block?.transactions) continue
        for (const tx of block.transactions) {
          if (
            tx.from?.toLowerCase() === addr.toLowerCase() ||
            tx.to?.toLowerCase() === addr.toLowerCase()
          ) {
            const gas = hexToNum(tx.gas ?? '0x0')
            const gasPrice = hexToNum(tx.gasPrice ?? '0x0') / 1e9
            const gasCost = (gas * gasPrice) / 1e9
            const ts = hexToNum(block.timestamp)
            found.push({
              hash: tx.hash,
              block: hexToNum(block.number),
              timestamp: ts,
              gas,
              gasPrice,
              gasCost,
              hour: new Date(ts * 1000).getUTCHours(),
              to: tx.to ?? 'Contract Creation',
              value: hexToNum(tx.value ?? '0x0') / 1e6,
            })
          }
        }
      }

      setTxs(found)
      setSearched(true)
    } catch {
      setError('Failed to fetch wallet data. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Build hour heatmap
  const hourMap: Record<number, { count: number; totalGas: number }> = {}
  for (let h = 0; h < 24; h++) hourMap[h] = { count: 0, totalGas: 0 }
  for (const tx of txs) {
    hourMap[tx.hour].count++
    hourMap[tx.hour].totalGas += tx.gasCost
  }
  const heatmapData = Object.entries(hourMap).map(([h, v]) => ({
    hour: `${h}h`,
    txs: v.count,
    gas: parseFloat(v.totalGas.toFixed(6)),
  }))

  const totalGas = txs.reduce((a, b) => a + b.gasCost, 0)
  const peakHour = heatmapData.reduce((a, b) => b.txs > a.txs ? b : a, heatmapData[0])

  return (
    <div style={{ marginTop: '2rem' }}>
      <div style={{ fontSize: 13, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' }}>
        🔍 Wallet Lookup
      </div>

      <div style={{ background: '#13131a', border: '1px solid #1e1e2e', borderRadius: 12, padding: '1.25rem' }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: '1rem' }}>
          <input
            type="text"
            placeholder="Enter wallet address (0x...)"
            value={address}
            onChange={e => setAddress(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && lookup()}
            style={{
              flex: 1, background: '#0a0a0f', border: '1px solid #1e1e2e',
              borderRadius: 8, padding: '10px 14px', color: '#f1f5f9',
              fontSize: 13, outline: 'none',
            }}
          />
          <button
            onClick={lookup}
            disabled={loading}
            style={{
              background: '#1D9E75', color: '#fff', border: 'none',
              borderRadius: 8, padding: '10px 20px', fontSize: 13,
              fontWeight: 500, cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>

        {error && (
          <div style={{ fontSize: 13, color: '#f87171', marginBottom: '1rem' }}>⚠ {error}</div>
        )}

        {searched && (
          <>
            {/* Summary cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, marginBottom: '1.25rem' }}>
              <MetricCard label="Balance" value={balance ?? '—'} unit="USDC" color="#1D9E75" />
              <MetricCard label="Transactions" value={txs.length} unit="found (last 200 blocks)" color="#378ADD" />
              <MetricCard label="Total gas spent" value={totalGas.toFixed(6)} unit="gwei" color="#EF9F27" />
              <MetricCard label="Peak hour" value={txs.length > 0 ? peakHour.hour : '—'} unit="UTC (most active)" color="#A78BFA" />
            </div>

            {txs.length > 0 ? (
              <>
                {/* Gas by hour chart */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={{ fontSize: 12, color: '#64748b', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Transactions by hour (UTC)
                  </div>
                  <ResponsiveContainer width="100%" height={140}>
                    <BarChart data={heatmapData}>
                      <CartesianGrid stroke="#1e1e2e" strokeDasharray="3 3" />
                      <XAxis dataKey="hour" tick={{ fontSize: 10, fill: '#475569' }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#475569' }} tickLine={false} axisLine={false} width={24} />
                      <Tooltip {...chartTooltipStyle} />
                      <Bar dataKey="txs" fill="#A78BFA" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Tx list */}
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Recent transactions
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ color: '#475569', fontSize: 11, textTransform: 'uppercase' }}>
                      <th style={{ textAlign: 'left', paddingBottom: 8, fontWeight: 500 }}>Hash</th>
                      <th style={{ textAlign: 'left', paddingBottom: 8, fontWeight: 500 }}>Block</th>
                      <th style={{ textAlign: 'left', paddingBottom: 8, fontWeight: 500 }}>Age</th>
                      <th style={{ textAlign: 'right', paddingBottom: 8, fontWeight: 500 }}>Gas (gwei)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {txs.slice(0, 10).map(tx => (
                      <tr key={tx.hash} style={{ borderTop: '1px solid #1e1e2e' }}>
                        <td style={{ padding: '8px 0', color: '#378ADD', fontFamily: 'monospace' }}>
                          {tx.hash.slice(0, 10)}...{tx.hash.slice(-6)}
                        </td>
                        <td style={{ padding: '8px 0', color: '#1D9E75' }}>#{tx.block.toLocaleString()}</td>
                        <td style={{ padding: '8px 0', color: '#64748b' }}>{timeAgo(tx.timestamp)}</td>
                        <td style={{ padding: '8px 0', textAlign: 'right', color: '#EF9F27' }}>{tx.gasCost.toFixed(6)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            ) : (
              <div style={{ fontSize: 13, color: '#475569', textAlign: 'center', padding: '1.5rem' }}>
                No transactions found for this address in the last 200 blocks.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default function Home() {
  const { data, refresh } = useArcData()

  const blockTimeData = data.blocks.slice(1).map((b, i) => ({
    block: `#${b.number.toLocaleString()}`,
    time: data.blocks[i + 1].timestamp - data.blocks[i].timestamp,
  }))

  const txData = data.blocks.map(b => ({
    block: `#${b.number.toLocaleString()}`,
    txs: b.txCount,
  }))

  const statusColor = data.status === 'live' ? '#1D9E75' : data.status === 'error' ? '#ef4444' : '#f59e0b'
  const statusLabel = data.status === 'live' ? 'Live' : data.status === 'error' ? 'Error' : 'Connecting...'

  return (
    <main style={{ minHeight: '100vh', background: '#0a0a0f', padding: '2rem 1.5rem', maxWidth: 1100, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <img src="/Arc_Logo.png" alt="ArcPulse" style={{ height: 100, width: 'auto' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#1D9E75', boxShadow: '0 0 8px #1D9E75', animation: 'pulse 2s infinite' }} />
            <p style={{ fontSize: 12, color: '#64748b' }}>Arc Testnet · Network Health Monitor</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: statusColor }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: statusColor }} />
            {statusLabel}
          </div>
          <button onClick={refresh} style={{ fontSize: 12, padding: '6px 14px', borderRadius: 8, border: '1px solid #1e1e2e', background: 'transparent', color: '#94a3b8', cursor: 'pointer' }}>
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: '1.5rem' }}>
        <MetricCard label="Latest block" value={data.latestBlock > 0 ? data.latestBlock.toLocaleString() : '—'} unit="block number" />
        <MetricCard label="Avg block time" value={data.avgBlockTime > 0 ? `${data.avgBlockTime}s` : '—'} unit="last 10 blocks" color="#378ADD" />
        <MetricCard label="Base fee" value={data.gasPrice !== '0' ? `${data.gasPrice}` : '—'} unit="gwei · USDC gas" color="#EF9F27" />
        <MetricCard label="RPC latency" value={data.rpcLatency > 0 ? `${data.rpcLatency}ms` : '—'} unit="response time" color="#A78BFA" />
        <MetricCard label="Tx (last block)" value={data.blocks.length > 0 ? data.blocks[data.blocks.length - 1].txCount : '—'} unit="transactions" color="#1D9E75" />
        <MetricCard label="Chain ID" value={data.chainId > 0 ? data.chainId : '—'} unit="Arc Testnet" color="#64748b" />
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: '1.5rem' }}>
        <div style={{ background: '#13131a', border: '1px solid #1e1e2e', borderRadius: 12, padding: '1rem 1.25rem' }}>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Block time (s)</div>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={blockTimeData}>
              <CartesianGrid stroke="#1e1e2e" strokeDasharray="3 3" />
              <XAxis dataKey="block" tick={{ fontSize: 10, fill: '#475569' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10, fill: '#475569' }} tickLine={false} axisLine={false} width={28} />
              <Tooltip {...chartTooltipStyle} />
              <Line type="monotone" dataKey="time" stroke="#1D9E75" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div style={{ background: '#13131a', border: '1px solid #1e1e2e', borderRadius: 12, padding: '1rem 1.25rem' }}>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Transactions per block</div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={txData}>
              <CartesianGrid stroke="#1e1e2e" strokeDasharray="3 3" />
              <XAxis dataKey="block" tick={{ fontSize: 10, fill: '#475569' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10, fill: '#475569' }} tickLine={false} axisLine={false} width={28} />
              <Tooltip {...chartTooltipStyle} />
              <Bar dataKey="txs" fill="#378ADD" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent blocks */}
      <div style={{ background: '#13131a', border: '1px solid #1e1e2e', borderRadius: 12, padding: '1rem 1.25rem' }}>
        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Recent blocks</div>
        {data.blocks.length === 0 ? (
          <div style={{ fontSize: 13, color: '#475569' }}>Loading blocks...</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ color: '#475569', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                <th style={{ textAlign: 'left', paddingBottom: 8, fontWeight: 500 }}>Block</th>
                <th style={{ textAlign: 'left', paddingBottom: 8, fontWeight: 500 }}>Age</th>
                <th style={{ textAlign: 'right', paddingBottom: 8, fontWeight: 500 }}>Transactions</th>
              </tr>
            </thead>
            <tbody>
              {[...data.blocks].reverse().map(b => (
                <tr key={b.number} style={{ borderTop: '1px solid #1e1e2e' }}>
                  <td style={{ padding: '9px 0', color: '#1D9E75', fontWeight: 500 }}>#{b.number.toLocaleString()}</td>
                  <td style={{ padding: '9px 0', color: '#64748b' }}>{timeAgo(b.timestamp)}</td>
                  <td style={{ padding: '9px 0', textAlign: 'right' }}>
                    <span style={{ background: '#0c1a2e', color: '#378ADD', fontSize: 11, padding: '2px 8px', borderRadius: 6 }}>{b.txCount} txs</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Wallet Lookup */}
      <WalletLookup />

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.5rem', fontSize: 11, color: '#334155' }}>
        <span>RPC: rpc.testnet.arc.network · Chain ID: 5042002 · Auto-refresh every 30s</span>
        <span>{data.lastUpdated ? `Updated ${data.lastUpdated.toLocaleTimeString()}` : '—'}</span>
      </div>

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
    </main>
  )
}
