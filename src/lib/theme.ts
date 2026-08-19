// ArcPulse dark theme tokens — extracted from the hardcoded hex literals that used
// to live directly in page.tsx JSX/style objects. Pure naming exercise: every value
// here is copied verbatim from the literal it replaces, nothing was restyled.

// Surfaces
export const SURFACES = {
  BG: '#0a0a0f', // page background, inputs, dark panels
  BG_SURFACE: '#13131a', // card / tab-bar background
  BORDER: '#1e1e2e', // borders, dividers, chart grid lines, progress track
}

// Text
export const TEXT = {
  PRIMARY: '#f1f5f9',
  SECONDARY: '#94a3b8',
  TERTIARY: '#64748b',
  MUTED: '#475569',
  FAINT: '#334155',
  ON_ACCENT: '#fff', // text on top of a solid accent-colored button/pill
  DEFAULT: '#e2e8f0', // body element fallback (globals.css) — distinct from TEXT.PRIMARY, only shows where nothing overrides it inline
}

// Accent — brand green plus feature-specific accents (AI report, Chainlink monitor).
// Some of these are literally the same hex as SEMANTIC/CHART_COLORS entries below;
// they're aliased rather than duplicated so there's a single source of truth per value.
export const ACCENT = {
  PRIMARY: '#1D9E75',
  BG_SELECTED: '#1a2a1a', // Reports tab: selected day highlight
  BG_MUTED: '#0c1a0c', // Gas Estimator: result panel background
  BLUE: '#378ADD',
  BLUE_BG: '#0c1a2e', // tx-count badges, Memo/Batch/Chainlink info banner backgrounds
  PURPLE: '#A78BFA',
  INDIGO: '#4f46e5', // AI Report button
  INDIGO_LIGHT: '#818cf8', // AI Report accent text
  INDIGO_BG: '#0a0a1a', // AI Report panel background
  INDIGO_BG_LOADING: '#1a1a2e', // AI Report button while generating
  CHAINLINK: '#375BD2', // Chainlink Monitor tab accent (distinct from ACCENT.BLUE)
}

// Semantic — status colors. The app actually uses four severity tiers, not three:
// success / warning / "degraded" (orange, between warning and danger) / danger.
export const SEMANTIC = {
  SUCCESS: ACCENT.PRIMARY,
  SUCCESS_BG: '#0d2b1f',
  WARNING: '#EF9F27',
  WARNING_BG: '#2b1e0a',
  DEGRADED: '#f97316',
  DEGRADED_BG: '#2b150a',
  DANGER: '#ef4444',
  DANGER_BG: '#2b0a0a',
  DANGER_BG_MUTED: '#1a1010', // Anomalies tab: selected critical item background
  DANGER_BORDER: '#3f1a1a', // RPC Endpoint Monitor: offline endpoint border
  PENDING: '#f59e0b', // Dev Dashboard: "connecting" wallet status dot
}

// Chart series — the four hues reused across every Recharts Line/Bar in the dashboard
export const CHART_COLORS = [ACCENT.PRIMARY, ACCENT.BLUE, ACCENT.PURPLE, SEMANTIC.WARNING] as const

// Other chains' brand colors (Networks comparison tab) — not part of ArcPulse's own
// palette, kept separate so they're never mistaken for design tokens.
export const NETWORK_BRAND_COLORS = {
  ARC: ACCENT.PRIMARY,
  ETHEREUM: '#627EEA',
  POLYGON: '#8247E5',
  BNB: '#F3BA2F',
  ARBITRUM: '#28A0F0',
}
