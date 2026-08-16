'use client'
import { useState, useEffect, useCallback } from 'react'

const RPC = 'https://rpc.testnet.arc.network'

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
const toGwei = (h: string) => (hexToNum(h) / 1e9).toFixed(2)

// Arc's block.timestamp only resolves to whole seconds, but the chain produces
// multiple blocks per second — so a single block-to-block delta can only ever
// read 0 or 1, which is noise, not a measurement. Averaging the delta over a
// SPAN_BLOCKS-block span recovers real sub-second precision from the same
// whole-second timestamps (e.g. 100 blocks landing in 44s = 0.44s/block).
// The series is SPAN_COUNT *non-overlapping* spans (latest-1000..latest), not a
// sliding window — a sliding window shares ~99% of its blocks with its neighbor,
// so it's nearly flat by construction and hides real variation over time.
const SPAN_BLOCKS = 100
const SPAN_COUNT = 10

export interface Block {
  number: number
  timestamp: number
  txCount: number
  gasUsed: number
}

export interface BlockTimePoint {
  block: number
  time: number
}

export interface NetworkData {
  latestBlock: number
  chainId: number
  gasPrice: string
  rpcLatency: number
  avgBlockTime: number
  blocks: Block[]
  blockTimeSeries: BlockTimePoint[]
  status: 'loading' | 'live' | 'error'
  lastUpdated: Date | null
}

export function useArcData() {
  const [data, setData] = useState<NetworkData>({
    latestBlock: 0, chainId: 0, gasPrice: '0',
    rpcLatency: 0, avgBlockTime: 0, blocks: [], blockTimeSeries: [],
    status: 'loading', lastUpdated: null,
  })

  const fetch = useCallback(async () => {
    try {
      const { result: blockHex, latency } = await rpcCall('eth_blockNumber')
      const latest = hexToNum(blockHex)
      const { result: chainHex } = await rpcCall('eth_chainId')
      const { result: gasHex } = await rpcCall('eth_gasPrice')

      const blockNums = Array.from({ length: 10 }, (_, i) => latest - 9 + i)
      const rawBlocks = await Promise.all(
        blockNums.map(n => rpcCall('eth_getBlockByNumber', ['0x' + n.toString(16), false]).then(r => r.result))
      )
      const valid = rawBlocks.filter(Boolean)

      const blocks: Block[] = valid.map(b => ({
        number: hexToNum(b.number),
        timestamp: hexToNum(b.timestamp),
        txCount: b.transactions?.length ?? 0,
        gasUsed: hexToNum(b.gasUsed ?? '0x0'),
      }))

      // Fetch the SPAN_COUNT+1 boundary blocks (latest, latest-100, latest-200, ...,
      // latest-1000) that divide the last 1000 blocks into SPAN_COUNT distinct,
      // back-to-back 100-block spans. Each span's time is (end - start) / SPAN_BLOCKS.
      const boundaryNums = Array.from({ length: SPAN_COUNT + 1 }, (_, j) => latest - j * SPAN_BLOCKS)
      const rawBoundaries = await Promise.all(
        boundaryNums.map(n => n > 0
          ? rpcCall('eth_getBlockByNumber', ['0x' + n.toString(16), false]).then(r => r.result)
          : Promise.resolve(null))
      )
      const boundaries = rawBoundaries.map(b => b ? { number: hexToNum(b.number), timestamp: hexToNum(b.timestamp) } : null)

      // boundaries[0] is `latest`, boundaries[SPAN_COUNT] is `latest - 1000`. Walk
      // from oldest to newest so the series reads left-to-right chronologically.
      const blockTimeSeries: BlockTimePoint[] = []
      for (let j = SPAN_COUNT; j >= 1; j--) {
        const start = boundaries[j]
        const end = boundaries[j - 1]
        if (!start || !end) continue
        blockTimeSeries.push({ block: end.number, time: parseFloat(((end.timestamp - start.timestamp) / SPAN_BLOCKS).toFixed(2)) })
      }

      // Metric card / Health Score input: the most recent span only (latest-100..latest).
      const avgBlockTime = blockTimeSeries.length > 0
        ? blockTimeSeries[blockTimeSeries.length - 1].time
        : 0

      setData({
        latestBlock: latest,
        chainId: hexToNum(chainHex),
        gasPrice: toGwei(gasHex),
        rpcLatency: latency,
        avgBlockTime,
        blocks,
        blockTimeSeries,
        status: 'live',
        lastUpdated: new Date(),
      })
    } catch {
      setData(d => ({ ...d, status: 'error' }))
    }
  }, [])

  useEffect(() => {
    fetch()
    const interval = setInterval(fetch, 30000)
    return () => clearInterval(interval)
  }, [fetch])

  return { data, refresh: fetch }
}
