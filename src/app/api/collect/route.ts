import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const RPC = 'https://rpc.testnet.arc.network'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

// If anything longer than this has passed since the last snapshot, something
// went wrong upstream (cron didn't fire, Supabase was unreachable, etc.) — the
// daily cron schedule plus Vercel's Hobby 1-hour scheduling window means a
// healthy gap should never exceed ~25h.
const STALE_GAP_HOURS = 26

async function sendDiscordAlert(message: string) {
  const webhook = process.env.DISCORD_WEBHOOK_URL
  if (!webhook) return // not configured — skip silently, don't fail the request over it
  try {
    await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: message }),
    })
  } catch {
    // best-effort only — a failed alert should never break /api/collect itself
  }
}

async function rpcCall(method: string, params: unknown[] = []) {
  const t0 = Date.now()
  const res = await fetch(RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  })
  const latency = Date.now() - t0
  const data = await res.json()
  return { result: data.result, latency }
}

const hexToNum = (h: string) => parseInt(h, 16)

function calcScore(blockTime: number, latency: number) {
  const blockScore = blockTime <= 0.5 ? 100 : blockTime <= 1 ? 85 : blockTime <= 2 ? 60 : 30
  const latencyScore = latency <= 200 ? 100 : latency <= 400 ? 80 : latency <= 700 ? 55 : 25
  return Math.round(blockScore * 0.4 + latencyScore * 0.35 + 100 * 0.25)
}

function getSeverity(score: number): string | null {
  if (score < 50) return 'critical'
  if (score < 70) return 'warning'
  return null
}

export async function GET() {
  try {
    // Check how long it's been since the last successful snapshot, *before*
    // inserting the new one — this is what catches a multi-day silent gap
    // (e.g. cron not firing, Supabase paused) the moment data collection
    // resumes, instead of it going unnoticed indefinitely.
    let gapHours: number | null = null
    try {
      const { data: lastRows } = await supabase
        .from('network_snapshots')
        .select('created_at')
        .order('created_at', { ascending: false })
        .limit(1)
      const lastCreatedAt = lastRows?.[0]?.created_at
      if (lastCreatedAt) {
        gapHours = (Date.now() - new Date(lastCreatedAt).getTime()) / 3_600_000
      }
    } catch {
      // if even the read fails, we'll find out below when the insert is attempted
    }

    const { result: blockHex, latency } = await rpcCall('eth_blockNumber')
    const latest = hexToNum(blockHex)
    const { result: chainHex } = await rpcCall('eth_chainId')
    const { result: gasHex } = await rpcCall('eth_gasPrice')

    const blockNums = Array.from({ length: 10 }, (_, i) => latest - 9 + i)
    const rawBlocks = await Promise.all(
      blockNums.map(n =>
        rpcCall('eth_getBlockByNumber', ['0x' + n.toString(16), false]).then(r => r.result)
      )
    )
    const valid = rawBlocks.filter(Boolean)

    const times: number[] = []
    let totalTx = 0
    for (let i = 1; i < valid.length; i++) {
      times.push(hexToNum(valid[i].timestamp) - hexToNum(valid[i - 1].timestamp))
      totalTx += valid[i].transactions?.length ?? 0
    }
    const avgBlockTime = times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0

    const score = calcScore(avgBlockTime, latency)
    const severity = getSeverity(score)

    const { error } = await supabase.from('network_snapshots').insert({
      created_at: new Date().toISOString(),
      block_number: latest,
      block_time_avg: parseFloat(avgBlockTime.toFixed(3)),
      gas_price: parseFloat((hexToNum(gasHex) / 1e9).toFixed(4)),
      rpc_latency: latency,
      tx_count: totalTx,
      chain_id: hexToNum(chainHex),
      health_score: score,
      anomaly: severity !== null,
      anomaly_severity: severity,
    })

    if (error) throw error

    if (gapHours !== null && gapHours > STALE_GAP_HOURS) {
      await sendDiscordAlert(
        `⚠️ **ArcPulse — collection gap detected**\nNo snapshot was recorded for about **${gapHours.toFixed(1)}h** before this one. Likely cause: a missed cron invocation (no auto-retry on Hobby) or the Supabase project was unreachable/paused. Collection has now resumed — block #${latest}.`
      )
    }

    return NextResponse.json({ success: true, block: latest, score, anomaly: severity !== null, severity })
  } catch (e) {
    await sendDiscordAlert(`🔴 **ArcPulse — /api/collect failed**\n\`\`\`${String(e).slice(0, 500)}\`\`\``)
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 })
  }
}

