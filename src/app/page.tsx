'use client'
import { useArcData } from './useArcData'
import { useState, useEffect } from 'react'
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'

const RPC = 'https://rpc.testnet.arc.network'
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

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

// ─── SUPABASE FETCH ───────────────────────────────────────────────
interface Snapshot {
  id: number
  created_at: string
  block_number: number
  block_time_avg: number
  gas_price: number
  rpc_latency: number
  tx_count: number
  chain_id: number
}

async function fetchSnapshots(from?: string, to?: string): Promise<Snapshot[]> {
  let url = `${SUPABASE_URL}/rest/v1/network_snapshots?select=*&order=created_at.asc`
  if (from) url += `&created_at=gte.${from}T00:00:00`
  if (to) url += `&created_at=lte.${to}T23:59:59`
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
  })
  return res.json()
}

function groupByDay(snapshots: Snapshot[]) {
  const map: Record<string, Snapshot[]> = {}
  for (const s of snapshots) {
    const day = s.created_at.slice(0, 10)
    if (!map[day]) map[day] = []
    map[day].push(s)
  }
  return map
}

function avg(arr: number[]) {
  if (!arr.length) return 0
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

function networkStatus(blockTime: number, latency: number) {
  if (blockTime < 1 && latency < 300) return { label: 'Healthy', color: '#1D9E75' }
  if (blockTime < 2 && latency < 600) return { label: 'Normal', color: '#EF9F27' }
  return { label: 'Degraded', color: '#ef4444' }
}

// ─── DASHBOARD TAB ────────────────────────────────────────────────
function DashboardTab() {
  const { data, refresh } = useArcData()
  const [gasHistory, setGasHistory] = useState<{day: string; gas: number}[]>([])
  const [builderActivity, setBuilderActivity] = useState<{day: string; contracts: number; txs: number}[]>([])

  useEffect(() => {
    // Gas history from Supabase
    fetchSnapshots().then(snaps => {
      const byDay = groupByDay(snaps)
      const gh = Object.entries(byDay).sort().map(([day, s]) => ({
        day: day.slice(5), // MM-DD
        gas: parseFloat(avg(s.map(x => x.gas_price)).toFixed(4)),
      }))
      setGasHistory(gh)

      // Builder activity: contracts = snapshots with high tx count as proxy, txs = total
      const ba = Object.entries(byDay).sort().map(([day, s]) => ({
        day: day.slice(5),
        contracts: s.filter(x => x.tx_count > 50).length,
        txs: Math.round(avg(s.map(x => x.tx_count))),
      }))
      setBuilderActivity(ba)
    })
  }, [])

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
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.25rem', gap: 12, alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: statusColor }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: statusColor }} />
          {statusLabel}
        </div>
        <button onClick={refresh} style={{ fontSize: 12, padding: '6px 14px', borderRadius: 8, border: '1px solid #1e1e2e', background: 'transparent', color: '#94a3b8', cursor: 'pointer' }}>
          ↻ Refresh
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: '1.5rem' }}>
        <MetricCard label="Latest block" value={data.latestBlock > 0 ? data.latestBlock.toLocaleString() : '—'} unit="block number" />
        <MetricCard label="Avg block time" value={data.avgBlockTime > 0 ? `${data.avgBlockTime}s` : '—'} unit="last 10 blocks" color="#378ADD" />
        <MetricCard label="Base fee" value={data.gasPrice !== '0' ? `${data.gasPrice}` : '—'} unit="gwei · USDC gas" color="#EF9F27" />
        <MetricCard label="RPC latency" value={data.rpcLatency > 0 ? `${data.rpcLatency}ms` : '—'} unit="response time" color="#A78BFA" />
        <MetricCard label="Tx (last block)" value={data.blocks.length > 0 ? data.blocks[data.blocks.length - 1].txCount : '—'} unit="transactions" color="#1D9E75" />
        <MetricCard label="Chain ID" value={data.chainId > 0 ? data.chainId : '—'} unit="Arc Testnet" color="#64748b" />
      </div>

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

      {/* Gas History + Builder Activity */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: '1.5rem' }}>
        <div style={{ background: '#13131a', border: '1px solid #1e1e2e', borderRadius: 12, padding: '1rem 1.25rem' }}>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Gas price history</div>
          <div style={{ fontSize: 11, color: '#334155', marginBottom: 10 }}>Average gwei per day — from Supabase snapshots</div>
          {gasHistory.length < 2 ? (
            <div style={{ fontSize: 12, color: '#475569', textAlign: 'center', padding: '2rem 0' }}>Collecting data... visit /api/collect to generate snapshots</div>
          ) : (
            <ResponsiveContainer width="100%" height={150}>
              <LineChart data={gasHistory}>
                <CartesianGrid stroke="#1e1e2e" strokeDasharray="3 3" />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#475569' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#475569' }} tickLine={false} axisLine={false} width={40} />
                <Tooltip {...chartTooltipStyle} />
                <Line type="monotone" dataKey="gas" stroke="#EF9F27" strokeWidth={2} dot={{ r: 3, fill: '#EF9F27' }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div style={{ background: '#13131a', border: '1px solid #1e1e2e', borderRadius: 12, padding: '1rem 1.25rem' }}>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Builder activity index</div>
          <div style={{ fontSize: 11, color: '#334155', marginBottom: 10 }}>Avg transactions per snapshot per day</div>
          {builderActivity.length < 2 ? (
            <div style={{ fontSize: 12, color: '#475569', textAlign: 'center', padding: '2rem 0' }}>Collecting data... more snapshots needed</div>
          ) : (
            <ResponsiveContainer width="100%" height={150}>
              <BarChart data={builderActivity}>
                <CartesianGrid stroke="#1e1e2e" strokeDasharray="3 3" />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#475569' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#475569' }} tickLine={false} axisLine={false} width={28} />
                <Tooltip {...chartTooltipStyle} />
                <Bar dataKey="txs" fill="#A78BFA" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

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
    </>
  )
}

// ─── REPORTS TAB ─────────────────────────────────────────────────
function ReportsTab() {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    fetchSnapshots().then(data => { setSnapshots(data); setLoading(false) })
  }, [])

  async function search() {
    setLoading(true)
    const data = await fetchSnapshots(from || undefined, to || undefined)
    setSnapshots(data)
    setLoading(false)
  }

  const byDay = groupByDay(snapshots)
  const days = Object.keys(byDay).sort().reverse()

  return (
    <div>
      {/* Filter bar */}
      <div style={{ background: '#13131a', border: '1px solid #1e1e2e', borderRadius: 12, padding: '1rem 1.25rem', marginBottom: '1.25rem', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ fontSize: 12, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Filter by date</div>
        <input type="date" value={from} onChange={e => setFrom(e.target.value)}
          style={{ background: '#0a0a0f', border: '1px solid #1e1e2e', borderRadius: 8, padding: '7px 12px', color: '#f1f5f9', fontSize: 13 }} />
        <span style={{ color: '#475569', fontSize: 13 }}>to</span>
        <input type="date" value={to} onChange={e => setTo(e.target.value)}
          style={{ background: '#0a0a0f', border: '1px solid #1e1e2e', borderRadius: 8, padding: '7px 12px', color: '#f1f5f9', fontSize: 13 }} />
        <button onClick={search} style={{ background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 18px', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
          Search
        </button>
        <button onClick={() => { setFrom(''); setTo(''); fetchSnapshots().then(setSnapshots) }}
          style={{ background: 'transparent', color: '#64748b', border: '1px solid #1e1e2e', borderRadius: 8, padding: '7px 14px', fontSize: 13, cursor: 'pointer' }}>
          Clear
        </button>
      </div>

      {loading ? (
        <div style={{ fontSize: 13, color: '#475569', textAlign: 'center', padding: '2rem' }}>Loading reports...</div>
      ) : days.length === 0 ? (
        <div style={{ fontSize: 13, color: '#475569', textAlign: 'center', padding: '2rem' }}>No reports found for this period.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 12 }}>
          {/* Day list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {days.map(day => {
              const snaps = byDay[day]
              const status = networkStatus(avg(snaps.map(s => s.block_time_avg)), avg(snaps.map(s => s.rpc_latency)))
              return (
                <div key={day} onClick={() => setSelected(day)}
                  style={{ background: selected === day ? '#1a2a1a' : '#13131a', border: `1px solid ${selected === day ? '#1D9E75' : '#1e1e2e'}`, borderRadius: 10, padding: '0.875rem 1rem', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: '#f1f5f9' }}>{day}</div>
                    <span style={{ fontSize: 11, color: status.color, background: `${status.color}22`, padding: '2px 8px', borderRadius: 6 }}>{status.label}</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>{snaps.length} snapshot{snaps.length > 1 ? 's' : ''}</div>
                </div>
              )
            })}
          </div>

          {/* Report detail */}
          <div style={{ background: '#13131a', border: '1px solid #1e1e2e', borderRadius: 12, padding: '1.25rem' }}>
            {!selected ? (
              <div style={{ fontSize: 13, color: '#475569', textAlign: 'center', marginTop: '3rem' }}>← Select a day to view the report</div>
            ) : (() => {
              const snaps = byDay[selected]
              const avgBlockTime = avg(snaps.map(s => s.block_time_avg))
              const avgGas = avg(snaps.map(s => s.gas_price))
              const avgLatency = avg(snaps.map(s => s.rpc_latency))
              const totalTx = snaps.reduce((a, s) => a + s.tx_count, 0)
              const status = networkStatus(avgBlockTime, avgLatency)
              const chartData = snaps.map(s => ({
                time: s.created_at.slice(11, 16),
                blockTime: s.block_time_avg,
                gas: s.gas_price,
                latency: s.rpc_latency,
              }))

              return (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 600, color: '#f1f5f9' }}>Report · {selected}</div>
                      <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>Arc Testnet · {snaps.length} snapshots</div>
                    </div>
                    <span style={{ fontSize: 13, color: status.color, background: `${status.color}22`, padding: '4px 12px', borderRadius: 8 }}>{status.label}</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: '1.25rem' }}>
                    <MetricCard label="Avg block time" value={`${avgBlockTime.toFixed(3)}s`} unit="seconds" color="#1D9E75" />
                    <MetricCard label="Avg gas" value={`${avgGas.toFixed(4)}`} unit="gwei" color="#EF9F27" />
                    <MetricCard label="Avg latency" value={`${Math.round(avgLatency)}ms`} unit="RPC response" color="#A78BFA" />
                    <MetricCard label="Total txs" value={totalTx} unit="transactions" color="#378ADD" />
                  </div>

                  {chartData.length > 1 && (
                    <>
                      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Block time over the day</div>
                      <ResponsiveContainer width="100%" height={120}>
                        <LineChart data={chartData}>
                          <CartesianGrid stroke="#1e1e2e" strokeDasharray="3 3" />
                          <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#475569' }} tickLine={false} axisLine={false} />
                          <YAxis tick={{ fontSize: 10, fill: '#475569' }} tickLine={false} axisLine={false} width={28} />
                          <Tooltip {...chartTooltipStyle} />
                          <Line type="monotone" dataKey="blockTime" stroke="#1D9E75" strokeWidth={2} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </>
                  )}

                  <div style={{ marginTop: '1rem', background: '#0a0a0f', borderRadius: 8, padding: '1rem', fontSize: 13, color: '#94a3b8', lineHeight: 1.7 }}>
                    <strong style={{ color: '#f1f5f9' }}>Summary</strong><br />
                    On {selected}, the Arc testnet recorded an average block time of <strong style={{ color: '#1D9E75' }}>{avgBlockTime.toFixed(3)}s</strong> {avgBlockTime < 1 ? '— well within the sub-second finality promise.' : '— slightly above the sub-second target.'}{' '}
                    Gas remained at <strong style={{ color: '#EF9F27' }}>{avgGas.toFixed(4)} gwei</strong> in USDC, showing {avgGas < 25 ? 'stable and predictable' : 'elevated'} fee behavior.{' '}
                    RPC latency averaged <strong style={{ color: '#A78BFA' }}>{Math.round(avgLatency)}ms</strong>, indicating a {avgLatency < 300 ? 'responsive' : 'moderately slow'} network.{' '}
                    Network status: <strong style={{ color: status.color }}>{status.label}</strong>.
                  </div>
                </>
              )
            })()}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── COMPARE TAB ─────────────────────────────────────────────────
function CompareTab() {
  const [periodA, setPeriodA] = useState({ from: '', to: '' })
  const [periodB, setPeriodB] = useState({ from: '', to: '' })
  const [dataA, setDataA] = useState<Snapshot[]>([])
  const [dataB, setDataB] = useState<Snapshot[]>([])
  const [loading, setLoading] = useState(false)
  const [compared, setCompared] = useState(false)

  async function compare() {
    if (!periodA.from || !periodB.from) return
    setLoading(true)
    const [a, b] = await Promise.all([
      fetchSnapshots(periodA.from, periodA.to || periodA.from),
      fetchSnapshots(periodB.from, periodB.to || periodB.from),
    ])
    setDataA(a)
    setDataB(b)
    setCompared(true)
    setLoading(false)
  }

  function CompareMetric({ label, a, b, unit, higherIsBetter = false }: {
    label: string; a: number; b: number; unit: string; higherIsBetter?: boolean
  }) {
    const diff = b - a
    const pct = a !== 0 ? ((diff / a) * 100).toFixed(1) : '0'
    const improved = higherIsBetter ? diff > 0 : diff < 0
    const color = diff === 0 ? '#64748b' : improved ? '#1D9E75' : '#ef4444'
    const arrow = diff === 0 ? '→' : diff > 0 ? '↑' : '↓'

    return (
      <div style={{ background: '#0a0a0f', borderRadius: 10, padding: '1rem', border: '1px solid #1e1e2e' }}>
        <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>{label}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 8, alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 600, color: '#f1f5f9' }}>{a.toFixed(3)}</div>
            <div style={{ fontSize: 11, color: '#475569' }}>Period A</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 18, color }}>{arrow}</div>
            <div style={{ fontSize: 11, color, fontWeight: 600 }}>{diff > 0 ? '+' : ''}{pct}%</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 20, fontWeight: 600, color: '#f1f5f9' }}>{b.toFixed(3)}</div>
            <div style={{ fontSize: 11, color: '#475569' }}>Period B</div>
          </div>
        </div>
        <div style={{ fontSize: 11, color: '#334155', marginTop: 6, textAlign: 'center' }}>{unit}</div>
      </div>
    )
  }

  const aBlockTime = avg(dataA.map(s => s.block_time_avg))
  const bBlockTime = avg(dataB.map(s => s.block_time_avg))
  const aGas = avg(dataA.map(s => s.gas_price))
  const bGas = avg(dataB.map(s => s.gas_price))
  const aLatency = avg(dataA.map(s => s.rpc_latency))
  const bLatency = avg(dataB.map(s => s.rpc_latency))
  const aTx = dataA.reduce((a, s) => a + s.tx_count, 0)
  const bTx = dataB.reduce((a, s) => a + s.tx_count, 0)

  return (
    <div>
      <div style={{ background: '#13131a', border: '1px solid #1e1e2e', borderRadius: 12, padding: '1.25rem', marginBottom: '1.25rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* Period A */}
          <div>
            <div style={{ fontSize: 12, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Period A</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input type="date" value={periodA.from} onChange={e => setPeriodA(p => ({ ...p, from: e.target.value }))}
                style={{ background: '#0a0a0f', border: '1px solid #1e1e2e', borderRadius: 8, padding: '7px 12px', color: '#f1f5f9', fontSize: 13 }} />
              <span style={{ color: '#475569', fontSize: 13, alignSelf: 'center' }}>to</span>
              <input type="date" value={periodA.to} onChange={e => setPeriodA(p => ({ ...p, to: e.target.value }))}
                style={{ background: '#0a0a0f', border: '1px solid #1e1e2e', borderRadius: 8, padding: '7px 12px', color: '#f1f5f9', fontSize: 13 }} />
            </div>
          </div>
          {/* Period B */}
          <div>
            <div style={{ fontSize: 12, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Period B</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input type="date" value={periodB.from} onChange={e => setPeriodB(p => ({ ...p, from: e.target.value }))}
                style={{ background: '#0a0a0f', border: '1px solid #1e1e2e', borderRadius: 8, padding: '7px 12px', color: '#f1f5f9', fontSize: 13 }} />
              <span style={{ color: '#475569', fontSize: 13, alignSelf: 'center' }}>to</span>
              <input type="date" value={periodB.to} onChange={e => setPeriodB(p => ({ ...p, to: e.target.value }))}
                style={{ background: '#0a0a0f', border: '1px solid #1e1e2e', borderRadius: 8, padding: '7px 12px', color: '#f1f5f9', fontSize: 13 }} />
            </div>
          </div>
        </div>
        <button onClick={compare} disabled={loading || !periodA.from || !periodB.from}
          style={{ marginTop: 16, background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 24px', fontSize: 13, fontWeight: 500, cursor: 'pointer', opacity: loading ? 0.7 : 1 }}>
          {loading ? 'Comparing...' : 'Compare'}
        </button>
      </div>

      {compared && (
        dataA.length === 0 || dataB.length === 0 ? (
          <div style={{ fontSize: 13, color: '#ef4444', textAlign: 'center', padding: '2rem' }}>
            No data found for one or both periods. Try different dates.
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div style={{ fontSize: 13, color: '#64748b' }}>
                Period A: <strong style={{ color: '#f1f5f9' }}>{periodA.from}{periodA.to && periodA.to !== periodA.from ? ` → ${periodA.to}` : ''}</strong> ({dataA.length} snapshots)
              </div>
              <div style={{ fontSize: 13, color: '#64748b' }}>
                Period B: <strong style={{ color: '#f1f5f9' }}>{periodB.from}{periodB.to && periodB.to !== periodB.from ? ` → ${periodB.to}` : ''}</strong> ({dataB.length} snapshots)
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: '1.25rem' }}>
              <CompareMetric label="Avg block time" a={aBlockTime} b={bBlockTime} unit="seconds — lower is better" />
              <CompareMetric label="Avg gas price" a={aGas} b={bGas} unit="gwei — lower is better" />
              <CompareMetric label="Avg RPC latency" a={aLatency} b={bLatency} unit="milliseconds — lower is better" />
              <CompareMetric label="Total transactions" a={aTx} b={bTx} unit="count — higher is better" higherIsBetter />
            </div>

            <div style={{ background: '#13131a', border: '1px solid #1e1e2e', borderRadius: 12, padding: '1.25rem' }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#f1f5f9', marginBottom: 8 }}>Comparison Summary</div>
              <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.8 }}>
                Comparing <strong style={{ color: '#f1f5f9' }}>Period A</strong> vs <strong style={{ color: '#f1f5f9' }}>Period B</strong>:{' '}
                Block time {bBlockTime < aBlockTime ? <span style={{ color: '#1D9E75' }}>improved by {(((aBlockTime - bBlockTime) / aBlockTime) * 100).toFixed(1)}%</span> : <span style={{ color: '#ef4444' }}>increased by {(((bBlockTime - aBlockTime) / aBlockTime) * 100).toFixed(1)}%</span>}.{' '}
                Gas price {bGas < aGas ? <span style={{ color: '#1D9E75' }}>decreased</span> : bGas > aGas ? <span style={{ color: '#ef4444' }}>increased</span> : <span style={{ color: '#64748b' }}>remained stable</span>}.{' '}
                RPC latency {bLatency < aLatency ? <span style={{ color: '#1D9E75' }}>improved</span> : <span style={{ color: '#ef4444' }}>degraded</span>}.{' '}
                Transaction volume {bTx > aTx ? <span style={{ color: '#1D9E75' }}>grew</span> : <span style={{ color: '#ef4444' }}>declined</span>}.
              </div>
            </div>
          </>
        )
      )}
    </div>
  )
}

// ─── ANOMALIES TAB ───────────────────────────────────────────────
function AnomaliesTab() {
  const [anomalies, setAnomalies] = useState<Snapshot[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Snapshot | null>(null)

  useEffect(() => {
    async function load() {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/network_snapshots?select=*&anomaly=eq.true&order=created_at.desc`,
        { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
      )
      const data = await res.json()
      setAnomalies(Array.isArray(data) ? data : [])
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <img src="/Anomalies_Logo.png" alt="Anomalies" style={{ height: 64, width: 'auto' }} />
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>All network anomalies detected and recorded automatically</div>
        </div>
        <div style={{ fontSize: 13, color: '#64748b' }}>
          {anomalies.length} anomal{anomalies.length === 1 ? 'y' : 'ies'} recorded
        </div>
      </div>

      {loading ? (
        <div style={{ fontSize: 13, color: '#475569', textAlign: 'center', padding: '3rem' }}>Loading anomaly log...</div>
      ) : anomalies.length === 0 ? (
        <div style={{ background: '#13131a', border: '1px solid #1e1e2e', borderRadius: 12, padding: '3rem', textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>✅</div>
          <div style={{ fontSize: 15, fontWeight: 500, color: '#1D9E75', marginBottom: 6 }}>No anomalies detected</div>
          <div style={{ fontSize: 13, color: '#475569' }}>The Arc testnet has been running smoothly. All recorded snapshots are within normal parameters.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 12 }}>
          {/* List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {anomalies.map(a => {
              const isCritical = (a as any).anomaly_severity === 'critical'
              const color = isCritical ? '#ef4444' : '#EF9F27'
              return (
                <div key={a.id} onClick={() => setSelected(a)}
                  style={{ background: selected?.id === a.id ? '#1a1010' : '#13131a', border: `1px solid ${selected?.id === a.id ? color : '#1e1e2e'}`, borderRadius: 10, padding: '0.875rem 1rem', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color, background: `${color}22`, padding: '2px 8px', borderRadius: 6, textTransform: 'uppercase' }}>
                      {(a as any).anomaly_severity ?? 'anomaly'}
                    </span>
                    <span style={{ fontSize: 11, color: '#475569' }}>Score: {(a as any).health_score ?? '—'}</span>
                  </div>
                  <div style={{ fontSize: 13, color: '#f1f5f9', fontWeight: 500 }}>{a.created_at.slice(0, 10)}</div>
                  <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>{a.created_at.slice(11, 19)} UTC</div>
                </div>
              )
            })}
          </div>

          {/* Detail */}
          <div style={{ background: '#13131a', border: '1px solid #1e1e2e', borderRadius: 12, padding: '1.25rem' }}>
            {!selected ? (
              <div style={{ fontSize: 13, color: '#475569', textAlign: 'center', marginTop: '3rem' }}>← Select an anomaly to view details</div>
            ) : (() => {
              const isCritical = (selected as any).anomaly_severity === 'critical'
              const color = isCritical ? '#ef4444' : '#EF9F27'
              const score = (selected as any).health_score ?? 0
              return (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 600, color: '#f1f5f9' }}>Anomaly Report</div>
                      <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>{selected.created_at.slice(0, 19).replace('T', ' ')} UTC</div>
                    </div>
                    <span style={{ fontSize: 13, color, background: `${color}22`, padding: '4px 12px', borderRadius: 8, textTransform: 'uppercase', fontWeight: 600 }}>
                      {(selected as any).anomaly_severity ?? 'anomaly'}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: '1.25rem' }}>
                    <MetricCard label="Health Score" value={score} unit="at detection" color={color} />
                    <MetricCard label="Block time" value={`${selected.block_time_avg}s`} unit="seconds" color="#378ADD" />
                    <MetricCard label="RPC latency" value={`${selected.rpc_latency}ms`} unit="milliseconds" color="#A78BFA" />
                    <MetricCard label="Gas price" value={`${selected.gas_price}`} unit="gwei" color="#EF9F27" />
                  </div>

                  <div style={{ background: '#0a0a0f', borderRadius: 8, padding: '1rem', fontSize: 13, color: '#94a3b8', lineHeight: 1.8 }}>
                    <strong style={{ color: '#f1f5f9' }}>Anomaly Analysis</strong><br />
                    A <strong style={{ color }}>{(selected as any).anomaly_severity}</strong> anomaly was detected on{' '}
                    <strong style={{ color: '#f1f5f9' }}>{selected.created_at.slice(0, 10)}</strong> at{' '}
                    <strong style={{ color: '#f1f5f9' }}>{selected.created_at.slice(11, 19)} UTC</strong>.{' '}
                    The network health score dropped to <strong style={{ color }}>{score}/100</strong>.{' '}
                    {selected.block_time_avg > 1
                      ? `Block time was elevated at ${selected.block_time_avg}s, above the sub-second target. `
                      : `Block time was ${selected.block_time_avg}s, within acceptable range. `}
                    {selected.rpc_latency > 400
                      ? `RPC latency was high at ${selected.rpc_latency}ms, indicating network stress.`
                      : `RPC latency was ${selected.rpc_latency}ms.`}
                  </div>
                </>
              )
            })()}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── NETWORK SCORE ────────────────────────────────────────────────
function calcScore(blockTime: number, latency: number, gasStability: number) {
  if (blockTime === 0 && latency === 0) return null
  const blockScore = blockTime <= 0.5 ? 100 : blockTime <= 1 ? 85 : blockTime <= 2 ? 60 : 30
  const latencyScore = latency <= 200 ? 100 : latency <= 400 ? 80 : latency <= 700 ? 55 : 25
  const gasScore = gasStability <= 1 ? 100 : gasStability <= 5 ? 80 : 50
  return Math.round(blockScore * 0.4 + latencyScore * 0.35 + gasScore * 0.25)
}

function scoreLabel(score: number | null) {
  if (score === null) return { label: '...', color: '#64748b', bg: '#1e1e2e' }
  if (score >= 90) return { label: 'Excellent', color: '#1D9E75', bg: '#0d2b1f' }
  if (score >= 70) return { label: 'Good', color: '#EF9F27', bg: '#2b1e0a' }
  if (score >= 50) return { label: 'Degraded', color: '#f97316', bg: '#2b150a' }
  return { label: 'ANOMALY', color: '#ef4444', bg: '#2b0a0a' }
}

// ─── MAIN APP ─────────────────────────────────────────────────────
export default function Home() {
  const [tab, setTab] = useState<'dashboard' | 'reports' | 'compare' | 'anomalies'>('dashboard')
  const { data } = useArcData()

  const score = calcScore(data.avgBlockTime, data.rpcLatency, 1)
  const { label, color, bg } = scoreLabel(score)
  const isAnomaly = score !== null && score < 50

  const tabs = [
    { id: 'dashboard', label: '📊 Dashboard' },
    { id: 'reports', label: '📋 Reports' },
    { id: 'compare', label: '⚖️ Compare' },
    { id: 'anomalies', label: '⚠️ Anomalies' },
  ] as const

  return (
    <main style={{ minHeight: '100vh', background: '#0a0a0f', padding: '1.5rem', maxWidth: 1100, margin: '0 auto' }}>

      {/* Anomaly banner */}
      {isAnomaly && (
        <div style={{ background: '#2b0a0a', border: '1px solid #ef4444', borderRadius: 10, padding: '10px 16px', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 16 }}>⚠️</span>
          <span style={{ fontSize: 13, color: '#ef4444', fontWeight: 500 }}>Network Anomaly Detected</span>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>— Block time or latency is above normal thresholds. Monitor closely.</span>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <img src="/Arc_Logo.png" alt="ArcPulse" style={{ height: 100, width: 'auto' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#1D9E75', boxShadow: '0 0 8px #1D9E75', animation: 'pulse 2s infinite' }} />
            <p style={{ fontSize: 12, color: '#64748b' }}>Arc Testnet · Network Health Monitor</p>
          </div>
        </div>

        {/* Network Score */}
        <div style={{ background: bg, border: `1px solid ${color}44`, borderRadius: 12, padding: '10px 18px', textAlign: 'center', minWidth: 110 }}>
          <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Health Score</div>
          <div style={{ fontSize: 28, fontWeight: 700, color, lineHeight: 1 }}>{score ?? '—'}</div>
          <div style={{ fontSize: 11, color, marginTop: 3, fontWeight: 500 }}>{label}</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: '1.5rem', background: '#13131a', borderRadius: 10, padding: 4, border: '1px solid #1e1e2e', width: 'fit-content' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{
              padding: '8px 20px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 500, cursor: 'pointer',
              background: tab === t.id ? '#1D9E75' : 'transparent',
              color: tab === t.id ? '#fff' : '#64748b',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'dashboard' && <DashboardTab />}
      {tab === 'reports' && <ReportsTab />}
      {tab === 'compare' && <CompareTab />}
      {tab === 'anomalies' && <AnomaliesTab />}

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.5rem', fontSize: 11, color: '#334155' }}>
        <span>RPC: rpc.testnet.arc.network · Chain ID: 5042002</span>
        <span>ArcPulse v0.3</span>
      </div>

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
    </main>
  )
}
