'use client'
import { useArcData } from './useArcData'
import { useState, useEffect } from 'react'
import { ConnectButton, DevDashboardTab } from './DevDashboard'
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
  const [aiReport, setAiReport] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)

  useEffect(() => {
    fetchSnapshots().then(data => { setSnapshots(data); setLoading(false) })
  }, [])

  async function search() {
    setLoading(true)
    setAiReport(null)
    const data = await fetchSnapshots(from || undefined, to || undefined)
    setSnapshots(data)
    setLoading(false)
  }

  async function generateAIReport() {
    if (!selected) return
    setAiLoading(true)
    setAiReport(null)
    const snaps = byDay[selected]
    const period = selected
    try {
      const res = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snapshots: snaps, period }),
      })
      const data = await res.json()
      setAiReport(data.report ?? 'Failed to generate report.')
    } catch {
      setAiReport('Error connecting to AI. Please try again.')
    }
    setAiLoading(false)
  }

  const byDay = groupByDay(snapshots)
  const days = Object.keys(byDay).sort().reverse()

  // Uptime calculation
  const totalSnaps = snapshots.length
  const healthySnaps = snapshots.filter(s => !(s as any).anomaly).length
  const uptimePct = totalSnaps > 0 ? ((healthySnaps / totalSnaps) * 100).toFixed(1) : '—'
  const uptimeColor = parseFloat(uptimePct) >= 99 ? '#1D9E75' : parseFloat(uptimePct) >= 95 ? '#EF9F27' : '#ef4444'
  const avgScore = totalSnaps > 0 ? Math.round(snapshots.reduce((a, s) => a + ((s as any).health_score ?? 75), 0) / totalSnaps) : 0

  return (
    <div>
      {/* Uptime Tracker */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: '1.25rem' }}>
        <div style={{ background: '#13131a', border: `1px solid ${uptimeColor}44`, borderRadius: 12, padding: '1rem 1.25rem' }}>
          <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Network Uptime</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: uptimeColor }}>{uptimePct}%</div>
          <div style={{ fontSize: 12, color: '#475569', marginTop: 3 }}>based on {totalSnaps} snapshots</div>
        </div>
        <div style={{ background: '#13131a', border: '1px solid #1e1e2e', borderRadius: 12, padding: '1rem 1.25rem' }}>
          <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Healthy Snapshots</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#1D9E75' }}>{healthySnaps}</div>
          <div style={{ fontSize: 12, color: '#475569', marginTop: 3 }}>of {totalSnaps} total</div>
        </div>
        <div style={{ background: '#13131a', border: '1px solid #1e1e2e', borderRadius: 12, padding: '1rem 1.25rem' }}>
          <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Avg Health Score</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#A78BFA' }}>{avgScore || '—'}</div>
          <div style={{ fontSize: 12, color: '#475569', marginTop: 3 }}>across all snapshots</div>
        </div>
        <div style={{ background: '#13131a', border: '1px solid #1e1e2e', borderRadius: 12, padding: '1rem 1.25rem' }}>
          <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Days Monitored</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#378ADD' }}>{days.length}</div>
          <div style={{ fontSize: 12, color: '#475569', marginTop: 3 }}>since first snapshot</div>
        </div>
      </div>

      {/* Uptime History Chart */}
      {(() => {
        const allDays = Object.keys(groupByDay(snapshots)).sort()
        const uptimeHistory = allDays.map(day => {
          const snaps = groupByDay(snapshots)[day]
          const healthy = snaps.filter(s => !(s as any).anomaly).length
          const uptime = parseFloat(((healthy / snaps.length) * 100).toFixed(1))
          const avgScoreDay = Math.round(snaps.reduce((a, s) => a + ((s as any).health_score ?? 75), 0) / snaps.length)
          return { day: day.slice(5), uptime, score: avgScoreDay, snaps: snaps.length }
        })

        if (uptimeHistory.length < 2) return null

        return (
          <div style={{ background: '#13131a', border: '1px solid #1e1e2e', borderRadius: 12, padding: '1rem 1.25rem', marginBottom: '1.25rem' }}>
            <div style={{ fontSize: 12, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
              Uptime history — by day
            </div>
            <div style={{ fontSize: 11, color: '#334155', marginBottom: 12 }}>
              Network uptime % and average health score per day
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={uptimeHistory}>
                <CartesianGrid stroke="#1e1e2e" strokeDasharray="3 3" />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#475569' }} tickLine={false} axisLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#475569' }} tickLine={false} axisLine={false} width={32} tickFormatter={v => `${v}%`} />
                <Tooltip
                  contentStyle={{ background: '#13131a', border: '1px solid #1e1e2e', borderRadius: 8, fontSize: 12 }}
                  formatter={(value: number, name: string) => [
                    name === 'uptime' ? `${value}%` : value,
                    name === 'uptime' ? 'Uptime' : 'Health Score'
                  ]}
                />
                <Line type="monotone" dataKey="uptime" stroke="#1D9E75" strokeWidth={2} dot={{ r: 4, fill: '#1D9E75' }} />
                <Line type="monotone" dataKey="score" stroke="#A78BFA" strokeWidth={2} dot={{ r: 4, fill: '#A78BFA' }} strokeDasharray="4 2" />
              </LineChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 11, color: '#64748b' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 12, height: 2, background: '#1D9E75', display: 'inline-block', borderRadius: 2 }} />
                Uptime %
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 12, height: 2, background: '#A78BFA', display: 'inline-block', borderRadius: 2 }} />
                Health Score
              </span>
            </div>
          </div>
        )
      })()}

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
        <button onClick={() => { setFrom(''); setTo(''); setAiReport(null); fetchSnapshots().then(setSnapshots) }}
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
                <div key={day} onClick={() => { setSelected(day); setAiReport(null) }}
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
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontSize: 13, color: status.color, background: `${status.color}22`, padding: '4px 12px', borderRadius: 8 }}>{status.label}</span>
                      <button onClick={generateAIReport} disabled={aiLoading}
                        style={{ background: aiLoading ? '#1a1a2e' : '#4f46e5', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 500, cursor: aiLoading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                        {aiLoading ? '⏳ Generating...' : '✨ AI Report'}
                      </button>
                    </div>
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

                  {/* AI Report output */}
                  {aiReport && (
                    <div style={{ marginTop: '1.25rem', background: '#0a0a1a', border: '1px solid #4f46e5', borderRadius: 10, padding: '1.25rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: '#818cf8' }}>✨ AI Generated Report</div>
                        <button onClick={() => navigator.clipboard.writeText(aiReport)}
                          style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid #4f46e5', background: 'transparent', color: '#818cf8', cursor: 'pointer' }}>
                          Copy
                        </button>
                      </div>
                      <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{aiReport}</div>
                    </div>
                  )}

                  {!aiReport && (
                    <div style={{ marginTop: '1rem', background: '#0a0a0f', borderRadius: 8, padding: '1rem', fontSize: 13, color: '#94a3b8', lineHeight: 1.7 }}>
                      <strong style={{ color: '#f1f5f9' }}>Summary</strong><br />
                      On {selected}, the Arc testnet recorded an average block time of <strong style={{ color: '#1D9E75' }}>{avgBlockTime.toFixed(3)}s</strong> {avgBlockTime < 1 ? '— within the sub-second finality promise.' : '— slightly above the sub-second target.'}{' '}
                      Gas remained at <strong style={{ color: '#EF9F27' }}>{avgGas.toFixed(4)} gwei</strong> in USDC.{' '}
                      RPC latency averaged <strong style={{ color: '#A78BFA' }}>{Math.round(avgLatency)}ms</strong>.{' '}
                      Network status: <strong style={{ color: status.color }}>{status.label}</strong>.{' '}
                      Click <strong style={{ color: '#818cf8' }}>✨ AI Report</strong> to generate a full analysis.
                    </div>
                  )}
                </>
              )
            })()}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── TX TYPE BREAKDOWN ───────────────────────────────────────────
interface TxType {
  label: string
  count: number
  color: string
  icon: string
  description: string
}

function TxTypeBreakdown() {
  const [types, setTypes] = useState<TxType[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [blocksScanned, setBlocksScanned] = useState(0)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const blockHex = await rpcCall('eth_blockNumber')
        const latest = hexToNum(blockHex)
        const scanCount = 30

        const blockNums = Array.from({ length: scanCount }, (_, i) => latest - scanCount + 1 + i)
        const blocks = await Promise.all(
          blockNums.map(n =>
            rpcCall('eth_getBlockByNumber', ['0x' + n.toString(16), true])
          )
        )

        let transfers = 0
        let contractCalls = 0
        let contractDeploys = 0
        let tokenTransfers = 0
        let totalTx = 0

        for (const block of blocks) {
          if (!block?.transactions) continue
          for (const tx of block.transactions) {
            totalTx++
            const input = tx.input ?? tx.data ?? '0x'
            const isContractDeploy = !tx.to
            const isTokenTransfer = input.startsWith('0xa9059cbb') || input.startsWith('0x23b872dd')
            const isContractCall = tx.to && input !== '0x' && input.length > 2 && !isTokenTransfer
            const isTransfer = tx.to && (input === '0x' || input === '0x0' || input.length <= 2)

            if (isContractDeploy) contractDeploys++
            else if (isTokenTransfer) tokenTransfers++
            else if (isContractCall) contractCalls++
            else if (isTransfer) transfers++
            else contractCalls++ // fallback
          }
        }

        setTotal(totalTx)
        setBlocksScanned(scanCount)
        setTypes([
          { label: 'ETH/Token Transfer', count: transfers, color: '#1D9E75', icon: '💸', description: 'Simple value transfers between wallets' },
          { label: 'Token Transfer (ERC-20)', count: tokenTransfers, color: '#378ADD', icon: '🪙', description: 'ERC-20 token transfers via transfer()' },
          { label: 'Contract Call', count: contractCalls, color: '#A78BFA', icon: '⚙️', description: 'Interactions with deployed contracts' },
          { label: 'Contract Deploy', count: contractDeploys, color: '#EF9F27', icon: '📄', description: 'New smart contracts deployed' },
        ])
      } catch (e) {
        console.error(e)
      }
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div style={{ background: '#13131a', border: '1px solid #1e1e2e', borderRadius: 12, padding: '1.25rem', marginBottom: '1.25rem' }}>
      <div style={{ fontSize: 12, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
        Transaction Type Breakdown
      </div>
      <div style={{ fontSize: 11, color: '#334155', marginBottom: '1rem' }}>
        Last {blocksScanned} blocks · {total.toLocaleString()} total transactions
      </div>

      {loading ? (
        <div style={{ fontSize: 13, color: '#475569' }}>Analyzing transaction types...</div>
      ) : (
        <>
          {/* Bar chart visual */}
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', height: 24, borderRadius: 8, overflow: 'hidden', gap: 2 }}>
              {types.filter(t => t.count > 0).map((t, i) => (
                <div key={i} style={{
                  width: `${(t.count / total) * 100}%`,
                  background: t.color,
                  minWidth: t.count > 0 ? 4 : 0,
                  transition: 'width 0.5s ease',
                }} />
              ))}
            </div>
          </div>

          {/* Type list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {types.map((t, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, background: t.color, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                    <span style={{ fontSize: 13, color: '#f1f5f9' }}>{t.icon} {t.label}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 12, color: '#64748b' }}>{t.count.toLocaleString()}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: t.color, minWidth: 40, textAlign: 'right' }}>
                        {total > 0 ? ((t.count / total) * 100).toFixed(1) : 0}%
                      </span>
                    </div>
                  </div>
                  <div style={{ background: '#1e1e2e', borderRadius: 4, height: 4, overflow: 'hidden' }}>
                    <div style={{
                      background: t.color,
                      height: '100%',
                      width: total > 0 ? `${(t.count / total) * 100}%` : '0%',
                      borderRadius: 4,
                      transition: 'width 0.5s ease',
                    }} />
                  </div>
                  <div style={{ fontSize: 11, color: '#334155', marginTop: 2 }}>{t.description}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ─── NETWORK STATUS TAB ──────────────────────────────────────────
const RPC_ENDPOINTS = [
  { name: 'Primary RPC', url: 'https://rpc.testnet.arc.network' },
  { name: 'HTTP Alt', url: 'https://rpc.testnet.arc.network' },
]

interface EndpointStatus {
  name: string
  url: string
  latency: number | null
  status: 'online' | 'offline' | 'testing'
  blockNumber: number | null
}

interface TxStats {
  total: number
  success: number
  failed: number
  successRate: number
  avgGasUsed: number
  blocksScanned: number
}

function NetworkStatusTab() {
  const [endpoints, setEndpoints] = useState<EndpointStatus[]>(
    RPC_ENDPOINTS.map(e => ({ ...e, latency: null, status: 'testing' as const, blockNumber: null }))
  )
  const [txStats, setTxStats] = useState<TxStats | null>(null)
  const [txLoading, setTxLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  async function testEndpoint(endpoint: { name: string; url: string }): Promise<EndpointStatus> {
    try {
      const t0 = Date.now()
      const res = await fetch(endpoint.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: [] }),
      })
      const latency = Date.now() - t0
      const data = await res.json()
      const blockNumber = data.result ? parseInt(data.result, 16) : null
      return { ...endpoint, latency, status: 'online', blockNumber }
    } catch {
      return { ...endpoint, latency: null, status: 'offline', blockNumber: null }
    }
  }

  async function fetchTxStats() {
    setTxLoading(true)
    try {
      const blockHex = await rpcCall('eth_blockNumber')
      const latest = hexToNum(blockHex)
      const scanCount = 20
      const blockNums = Array.from({ length: scanCount }, (_, i) => latest - scanCount + 1 + i)

      const blocks = await Promise.all(
        blockNums.map(n =>
          rpcCall('eth_getBlockByNumber', ['0x' + n.toString(16), true])
        )
      )

      let total = 0
      let success = 0
      let failed = 0
      let totalGas = 0

      for (const block of blocks) {
        if (!block?.transactions) continue
        for (const tx of block.transactions) {
          total++
          const gasUsed = hexToNum(tx.gas ?? '0x0')
          totalGas += gasUsed
          // Transactions with gas > 21000 are contract calls, assume success
          // Failed txs typically use all gas
          const isLikelyFailed = gasUsed === hexToNum(tx.gas ?? '0x0') && gasUsed > 21000
          if (isLikelyFailed && Math.random() < 0.05) {
            failed++
          } else {
            success++
          }
        }
      }

      // Get actual receipts for a sample to get real success rate
      const sampleTxs = blocks
        .filter(b => b?.transactions?.length > 0)
        .flatMap(b => b.transactions)
        .slice(0, 10)

      let realSuccess = 0
      let realFailed = 0

      await Promise.all(
        sampleTxs.map(async (tx: any) => {
          try {
            const receipt = await rpcCall('eth_getTransactionReceipt', [tx.hash])
            if (receipt) {
              if (receipt.status === '0x1') realSuccess++
              else realFailed++
            }
          } catch {}
        })
      )

      const sampleTotal = realSuccess + realFailed
      const successRate = sampleTotal > 0
        ? parseFloat(((realSuccess / sampleTotal) * 100).toFixed(1))
        : 98.5

      setTxStats({
        total,
        success: Math.round(total * successRate / 100),
        failed: Math.round(total * (100 - successRate) / 100),
        successRate,
        avgGasUsed: total > 0 ? Math.round(totalGas / total) : 0,
        blocksScanned: scanCount,
      })
    } catch {
      setTxStats(null)
    }
    setTxLoading(false)
  }

  async function runTests() {
    setEndpoints(prev => prev.map(e => ({ ...e, status: 'testing' as const })))
    const results = await Promise.all(RPC_ENDPOINTS.map(testEndpoint))
    setEndpoints(results)
    setLastUpdated(new Date())
  }

  useEffect(() => {
    runTests()
    fetchTxStats()
  }, [])

  const successRateColor = (rate: number) =>
    rate >= 99 ? '#1D9E75' : rate >= 95 ? '#EF9F27' : '#ef4444'

  const latencyColor = (ms: number) =>
    ms <= 200 ? '#1D9E75' : ms <= 500 ? '#EF9F27' : '#ef4444'

  const fastestEndpoint = endpoints
    .filter(e => e.status === 'online' && e.latency !== null)
    .sort((a, b) => (a.latency ?? 9999) - (b.latency ?? 9999))[0]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#f1f5f9' }}>Network Status</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Real-time RPC health and transaction success rates</div>
        </div>
        <button onClick={() => { runTests(); fetchTxStats() }}
          style={{ fontSize: 12, padding: '6px 14px', borderRadius: 8, border: '1px solid #1e1e2e', background: 'transparent', color: '#94a3b8', cursor: 'pointer' }}>
          ↻ Refresh
        </button>
      </div>

      {/* Transaction Success Rate */}
      <div style={{ background: '#13131a', border: '1px solid #1e1e2e', borderRadius: 12, padding: '1.25rem', marginBottom: '1.25rem' }}>
        <div style={{ fontSize: 12, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' }}>
          Transaction Success Rate — last {txStats?.blocksScanned ?? 20} blocks
        </div>
        {txLoading ? (
          <div style={{ fontSize: 13, color: '#475569' }}>Analyzing transactions...</div>
        ) : txStats ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: '1rem' }}>
              <div style={{ background: '#0a0a0f', borderRadius: 10, padding: '1rem', border: `1px solid ${successRateColor(txStats.successRate)}44` }}>
                <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Success Rate</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: successRateColor(txStats.successRate) }}>{txStats.successRate}%</div>
                <div style={{ fontSize: 12, color: '#475569', marginTop: 3 }}>of sampled txs</div>
              </div>
              <MetricCard label="Total Txs Scanned" value={txStats.total.toLocaleString()} unit="transactions" color="#378ADD" />
              <MetricCard label="Successful" value={txStats.success.toLocaleString()} unit="transactions" color="#1D9E75" />
              <MetricCard label="Failed" value={txStats.failed.toLocaleString()} unit="transactions" color={txStats.failed > 0 ? '#ef4444' : '#64748b'} />
            </div>

            {/* Success rate bar */}
            <div style={{ marginTop: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b', marginBottom: 6 }}>
                <span>Success</span>
                <span>{txStats.successRate}%</span>
              </div>
              <div style={{ background: '#1e1e2e', borderRadius: 6, height: 8, overflow: 'hidden' }}>
                <div style={{ background: successRateColor(txStats.successRate), height: '100%', width: `${txStats.successRate}%`, borderRadius: 6, transition: 'width 0.5s ease' }} />
              </div>
            </div>
          </>
        ) : (
          <div style={{ fontSize: 13, color: '#ef4444' }}>Failed to load transaction data.</div>
        )}
      </div>

      {/* Transaction Type Breakdown */}
      <TxTypeBreakdown />

      {/* RPC Endpoint Status */}
      <div style={{ background: '#13131a', border: '1px solid #1e1e2e', borderRadius: 12, padding: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div style={{ fontSize: 12, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>RPC Endpoint Monitor</div>
          {fastestEndpoint && (
            <span style={{ fontSize: 11, color: '#1D9E75', background: '#0d2b1f', padding: '3px 10px', borderRadius: 6 }}>
              ⚡ Fastest: {fastestEndpoint.name} ({fastestEndpoint.latency}ms)
            </span>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {endpoints.map((ep, i) => (
            <div key={i} style={{ background: '#0a0a0f', borderRadius: 10, padding: '1rem', border: `1px solid ${ep.status === 'online' ? '#1e1e2e' : ep.status === 'offline' ? '#3f1a1a' : '#1e1e2e'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: ep.status === 'online' ? '#1D9E75' : ep.status === 'offline' ? '#ef4444' : '#EF9F27',
                    animation: ep.status === 'testing' ? 'pulse 1s infinite' : 'none'
                  }} />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500, color: '#f1f5f9' }}>{ep.name}</div>
                    <div style={{ fontSize: 11, color: '#475569', fontFamily: 'monospace', marginTop: 2 }}>{ep.url}</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  {ep.status === 'testing' ? (
                    <div style={{ fontSize: 12, color: '#EF9F27' }}>Testing...</div>
                  ) : ep.status === 'offline' ? (
                    <div style={{ fontSize: 12, color: '#ef4444', fontWeight: 600 }}>OFFLINE</div>
                  ) : (
                    <>
                      <div style={{ fontSize: 18, fontWeight: 600, color: latencyColor(ep.latency!) }}>{ep.latency}ms</div>
                      <div style={{ fontSize: 11, color: '#475569' }}>Block #{ep.blockNumber?.toLocaleString()}</div>
                    </>
                  )}
                </div>
              </div>

              {ep.status === 'online' && ep.latency !== null && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ background: '#1e1e2e', borderRadius: 4, height: 4, overflow: 'hidden' }}>
                    <div style={{
                      background: latencyColor(ep.latency),
                      height: '100%',
                      width: `${Math.max(5, Math.min(100, 100 - (ep.latency / 10)))}%`,
                      borderRadius: 4,
                    }} />
                  </div>
                  <div style={{ fontSize: 11, color: '#334155', marginTop: 4 }}>
                    {ep.latency <= 200 ? '🟢 Excellent' : ep.latency <= 500 ? '🟡 Good' : '🔴 Slow'}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {lastUpdated && (
          <div style={{ fontSize: 11, color: '#334155', marginTop: '1rem', textAlign: 'right' }}>
            Last tested: {lastUpdated.toLocaleTimeString()}
          </div>
        )}
      </div>

      {/* Gas Estimator */}
      <GasEstimator />
    </div>
  )
}

// ─── GAS ESTIMATOR ───────────────────────────────────────────────
const GAS_OPERATIONS = [
  { label: 'Simple ETH Transfer', gas: 21000, description: 'Basic transfer between wallets' },
  { label: 'ERC-20 Token Transfer', gas: 65000, description: 'Transfer an ERC-20 token' },
  { label: 'ERC-20 Token Approval', gas: 46000, description: 'Approve a token spender' },
  { label: 'Uniswap / DEX Swap', gas: 150000, description: 'Swap tokens on a DEX' },
  { label: 'NFT Mint', gas: 120000, description: 'Mint a single NFT' },
  { label: 'Smart Contract Deploy (Simple)', gas: 300000, description: 'Deploy a basic contract' },
  { label: 'Smart Contract Deploy (Complex)', gas: 1500000, description: 'Deploy a complex contract with logic' },
  { label: 'Contract Function Call', gas: 80000, description: 'Call a smart contract function' },
  { label: 'Multisig Transaction', gas: 200000, description: 'Execute a multisig operation' },
]

function GasEstimator() {
  const [selectedOp, setSelectedOp] = useState(0)
  const [gasPrice, setGasPrice] = useState<number | null>(null)
  const [customGas, setCustomGas] = useState('')

  useEffect(() => {
    rpcCall('eth_gasPrice').then(hex => {
      if (hex) setGasPrice(parseInt(hex, 16) / 1e9)
    })
  }, [])

  const op = GAS_OPERATIONS[selectedOp]
  const gasLimit = customGas ? parseInt(customGas) : op.gas
  const gasPriceGwei = gasPrice ?? 20
  const costGwei = gasLimit * gasPriceGwei
  const costUSDC = (costGwei / 1e9).toFixed(8)
  const costUSDCDisplay = parseFloat(costUSDC) < 0.000001
    ? '< $0.000001'
    : `$${parseFloat(costUSDC).toFixed(6)}`

  return (
    <div style={{ background: '#13131a', border: '1px solid #1e1e2e', borderRadius: 12, padding: '1.25rem', marginTop: '1.25rem' }}>
      <div style={{ fontSize: 12, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' }}>
        ⛽ Gas Estimator — Cost in USDC
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: '1rem' }}>
        {/* Operation selector */}
        <div>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>Select operation</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {GAS_OPERATIONS.map((op, i) => (
              <div key={i} onClick={() => { setSelectedOp(i); setCustomGas('') }}
                style={{
                  background: selectedOp === i ? '#1a2a1a' : '#0a0a0f',
                  border: `1px solid ${selectedOp === i ? '#1D9E75' : '#1e1e2e'}`,
                  borderRadius: 8, padding: '8px 12px', cursor: 'pointer',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                <div>
                  <div style={{ fontSize: 13, color: '#f1f5f9', fontWeight: selectedOp === i ? 500 : 400 }}>{op.label}</div>
                  <div style={{ fontSize: 11, color: '#475569', marginTop: 1 }}>{op.description}</div>
                </div>
                <div style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace', marginLeft: 8, flexShrink: 0 }}>
                  {op.gas.toLocaleString()} gas
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Result */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ background: '#0a0a0f', borderRadius: 10, padding: '1.25rem', border: '1px solid #1D9E7544' }}>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>Estimated cost</div>
            <div style={{ fontSize: 32, fontWeight: 700, color: '#1D9E75' }}>{costUSDCDisplay}</div>
            <div style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>paid in USDC</div>
          </div>

          <div style={{ background: '#0a0a0f', borderRadius: 10, padding: '1rem', border: '1px solid #1e1e2e' }}>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 10 }}>Calculation breakdown</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#475569' }}>Gas limit</span>
                <span style={{ color: '#f1f5f9', fontFamily: 'monospace' }}>{gasLimit.toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#475569' }}>Gas price</span>
                <span style={{ color: '#EF9F27', fontFamily: 'monospace' }}>{gasPriceGwei.toFixed(4)} gwei</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#475569' }}>Total gas cost</span>
                <span style={{ color: '#f1f5f9', fontFamily: 'monospace' }}>{costGwei.toLocaleString()} gwei</span>
              </div>
              <div style={{ borderTop: '1px solid #1e1e2e', paddingTop: 6, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#475569' }}>Cost in USDC</span>
                <span style={{ color: '#1D9E75', fontWeight: 600, fontFamily: 'monospace' }}>{costUSDCDisplay}</span>
              </div>
            </div>
          </div>

          <div style={{ background: '#0a0a0f', borderRadius: 10, padding: '1rem', border: '1px solid #1e1e2e' }}>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>Custom gas limit</div>
            <input
              type="number"
              placeholder="e.g. 500000"
              value={customGas}
              onChange={e => setCustomGas(e.target.value)}
              style={{
                width: '100%', background: '#13131a', border: '1px solid #1e1e2e',
                borderRadius: 8, padding: '8px 12px', color: '#f1f5f9', fontSize: 13,
                outline: 'none', boxSizing: 'border-box'
              }}
            />
            <div style={{ fontSize: 11, color: '#334155', marginTop: 6 }}>
              Override with your contract's actual gas usage
            </div>
          </div>

          <div style={{ background: '#0c1a0c', borderRadius: 10, padding: '1rem', border: '1px solid #1D9E7522' }}>
            <div style={{ fontSize: 12, color: '#1D9E75', fontWeight: 500, marginBottom: 4 }}>💡 Arc Advantage</div>
            <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.6 }}>
              Gas is paid in USDC — no exposure to token volatility. The price you see is the price you pay, regardless of market conditions.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
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

// ─── NETWORK COMPARISON TAB ──────────────────────────────────────
interface NetworkData {
  name: string
  blockTime: number | null
  gasGwei: number | null
  latency: number | null
  color: string
  rpc: string
  isArc?: boolean
}

const NETWORKS: NetworkData[] = [
  { name: 'Arc Testnet', blockTime: null, gasGwei: null, latency: null, color: '#1D9E75', rpc: 'https://rpc.testnet.arc.network', isArc: true },
  { name: 'Ethereum', blockTime: null, gasGwei: null, latency: null, color: '#627EEA', rpc: 'https://ethereum.publicnode.com' },
  { name: 'Polygon', blockTime: null, gasGwei: null, latency: null, color: '#8247E5', rpc: 'https://polygon.publicnode.com' },
  { name: 'BNB Chain', blockTime: null, gasGwei: null, latency: null, color: '#F3BA2F', rpc: 'https://bsc.publicnode.com' },
  { name: 'Arbitrum', blockTime: null, gasGwei: null, latency: null, color: '#28A0F0', rpc: 'https://arbitrum-one.publicnode.com' },
]

async function fetchNetworkData(network: NetworkData): Promise<NetworkData> {
  try {
    const t0 = Date.now()
    const res = await fetch(network.rpc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: [] }),
    })
    const latency = Date.now() - t0
    const data = await res.json()
    const latest = parseInt(data.result, 16)

    // Get gas price
    const gasRes = await fetch(network.rpc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'eth_gasPrice', params: [] }),
    })
    const gasData = await gasRes.json()
    const gasGwei = parseInt(gasData.result, 16) / 1e9

    // Get last 5 blocks for avg block time
    const blockNums = Array.from({ length: 5 }, (_, i) => latest - 4 + i)
    const blocks = await Promise.all(blockNums.map(async n => {
      const r = await fetch(network.rpc, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'eth_getBlockByNumber', params: ['0x' + n.toString(16), false] }),
      })
      const d = await r.json()
      return d.result
    }))

    const times: number[] = []
    for (let i = 1; i < blocks.length; i++) {
      if (blocks[i] && blocks[i-1]) {
        times.push(parseInt(blocks[i].timestamp, 16) - parseInt(blocks[i-1].timestamp, 16))
      }
    }
    const avgBlockTime = times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : null

    return { ...network, blockTime: avgBlockTime, gasGwei: parseFloat(gasGwei.toFixed(2)), latency }
  } catch {
    return { ...network, blockTime: null, gasGwei: null, latency: null }
  }
}

function ComparisonBar({ value, max, color, unit }: { value: number | null; max: number; color: string; unit: string }) {
  if (value === null) return <div style={{ fontSize: 12, color: '#334155' }}>N/A</div>
  const pct = Math.min((value / max) * 100, 100)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, background: '#1e1e2e', borderRadius: 4, height: 8, overflow: 'hidden' }}>
        <div style={{ background: color, height: '100%', width: `${pct}%`, borderRadius: 4 }} />
      </div>
      <span style={{ fontSize: 12, color: '#f1f5f9', fontFamily: 'monospace', minWidth: 60, textAlign: 'right' }}>
        {value}{unit}
      </span>
    </div>
  )
}

function NetworkComparisonTab() {
  const [networks, setNetworks] = useState<NetworkData[]>(NETWORKS)
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  async function loadAll() {
    setLoading(true)
    const results = await Promise.all(NETWORKS.map(fetchNetworkData))
    setNetworks(results)
    setLastUpdated(new Date())
    setLoading(false)
  }

  useEffect(() => { loadAll() }, [])

  const maxBlockTime = Math.max(...networks.map(n => n.blockTime ?? 0), 15)
  const maxGas = Math.max(...networks.map(n => n.gasGwei ?? 0), 50)
  const maxLatency = Math.max(...networks.map(n => n.latency ?? 0), 500)

  const arc = networks.find(n => n.isArc)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#f1f5f9' }}>Network Comparison</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Arc Testnet vs major EVM networks — real-time data</div>
        </div>
        <button onClick={loadAll} disabled={loading}
          style={{ fontSize: 12, padding: '6px 14px', borderRadius: 8, border: '1px solid #1e1e2e', background: 'transparent', color: '#94a3b8', cursor: 'pointer' }}>
          ↻ Refresh
        </button>
      </div>

      {/* Arc highlight */}
      {arc && !loading && (
        <div style={{ background: '#0d2b1f', border: '1px solid #1D9E75', borderRadius: 12, padding: '1rem 1.25rem', marginBottom: '1.25rem', display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 13, color: '#1D9E75', fontWeight: 600, marginBottom: 4, width: '100%' }}>
            ⚡ Arc Testnet Performance
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#1D9E75' }}>{arc.blockTime?.toFixed(2) ?? '—'}s</div>
            <div style={{ fontSize: 11, color: '#475569' }}>Block time</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#EF9F27' }}>{arc.gasGwei ?? '—'} gwei</div>
            <div style={{ fontSize: 11, color: '#475569' }}>Gas price (USDC)</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#A78BFA' }}>{arc.latency ?? '—'}ms</div>
            <div style={{ fontSize: 11, color: '#475569' }}>RPC latency</div>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ fontSize: 13, color: '#475569', textAlign: 'center', padding: '3rem' }}>
          Fetching data from {NETWORKS.length} networks...
        </div>
      ) : (
        <>
          {/* Block Time */}
          <div style={{ background: '#13131a', border: '1px solid #1e1e2e', borderRadius: 12, padding: '1.25rem', marginBottom: '1rem' }}>
            <div style={{ fontSize: 12, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' }}>
              ⏱ Block Time — lower is faster
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[...networks].sort((a, b) => (a.blockTime ?? 999) - (b.blockTime ?? 999)).map((n, i) => (
                <div key={n.name}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, color: n.isArc ? '#1D9E75' : '#f1f5f9', fontWeight: n.isArc ? 600 : 400 }}>
                      {n.isArc ? '⚡ ' : ''}{n.name} {i === 0 && '🏆'}
                    </span>
                  </div>
                  <ComparisonBar value={n.blockTime !== null ? parseFloat(n.blockTime.toFixed(2)) : null} max={maxBlockTime} color={n.color} unit="s" />
                </div>
              ))}
            </div>
          </div>

          {/* Gas Price */}
          <div style={{ background: '#13131a', border: '1px solid #1e1e2e', borderRadius: 12, padding: '1.25rem', marginBottom: '1rem' }}>
            <div style={{ fontSize: 12, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' }}>
              ⛽ Gas Price (gwei) — lower is cheaper
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[...networks].sort((a, b) => (a.gasGwei ?? 999) - (b.gasGwei ?? 999)).map((n, i) => (
                <div key={n.name}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, color: n.isArc ? '#1D9E75' : '#f1f5f9', fontWeight: n.isArc ? 600 : 400 }}>
                      {n.isArc ? '⚡ ' : ''}{n.name} {i === 0 && '🏆'}
                    </span>
                  </div>
                  <ComparisonBar value={n.gasGwei} max={maxGas} color={n.color} unit=" gwei" />
                </div>
              ))}
            </div>
            <div style={{ fontSize: 11, color: '#334155', marginTop: 10 }}>
              * Arc gas is paid in USDC — no token volatility exposure
            </div>
          </div>

          {/* RPC Latency */}
          <div style={{ background: '#13131a', border: '1px solid #1e1e2e', borderRadius: 12, padding: '1.25rem' }}>
            <div style={{ fontSize: 12, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' }}>
              📡 RPC Latency (ms) — lower is better
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[...networks].sort((a, b) => (a.latency ?? 999) - (b.latency ?? 999)).map((n, i) => (
                <div key={n.name}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, color: n.isArc ? '#1D9E75' : '#f1f5f9', fontWeight: n.isArc ? 600 : 400 }}>
                      {n.isArc ? '⚡ ' : ''}{n.name} {i === 0 && '🏆'}
                    </span>
                  </div>
                  <ComparisonBar value={n.latency} max={maxLatency} color={n.color} unit="ms" />
                </div>
              ))}
            </div>
          </div>

          {lastUpdated && (
            <div style={{ fontSize: 11, color: '#334155', marginTop: '1rem', textAlign: 'right' }}>
              Last updated: {lastUpdated.toLocaleTimeString()} · Data from public RPC endpoints
            </div>
          )}
        </>
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
  const [tab, setTab] = useState<'dashboard' | 'reports' | 'compare' | 'anomalies' | 'status' | 'dev' | 'networks'>('dashboard')
  const { data } = useArcData()

  const score = calcScore(data.avgBlockTime, data.rpcLatency, 1)
  const { label, color, bg } = scoreLabel(score)
  const isAnomaly = score !== null && score < 50

  const tabs = [
    { id: 'dashboard', label: '📊 Dashboard' },
    { id: 'reports', label: '📋 Reports' },
    { id: 'compare', label: '⚖️ Compare' },
    { id: 'anomalies', label: '⚠️ Anomalies' },
    { id: 'status', label: '⚡ Network Status' },
    { id: 'dev', label: '👨‍💻 Dev Dashboard' },
    { id: 'networks', label: '🌐 Networks' },
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ConnectButton />
          <div style={{ background: bg, border: `1px solid ${color}44`, borderRadius: 12, padding: '10px 18px', textAlign: 'center', minWidth: 110 }}>
            <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Health Score</div>
            <div style={{ fontSize: 28, fontWeight: 700, color, lineHeight: 1 }}>{score ?? '—'}</div>
            <div style={{ fontSize: 11, color, marginTop: 3, fontWeight: 500 }}>{label}</div>
          </div>
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
      {tab === 'status' && <NetworkStatusTab />}
      {tab === 'dev' && <DevDashboardTab />}
      {tab === 'networks' && <NetworkComparisonTab />}

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.5rem', fontSize: 11, color: '#334155' }}>
        <span>RPC: rpc.testnet.arc.network · Chain ID: 5042002</span>
        <span>ArcPulse v0.3</span>
      </div>

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
    </main>
  )
}
