import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const RPC = 'https://rpc.testnet.arc.network'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

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

    return NextResponse.json({ success: true, block: latest, score, anomaly: severity !== null, severity })
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 })
  }
}
