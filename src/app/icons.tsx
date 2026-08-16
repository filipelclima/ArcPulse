// Hand-written inline icons (no lucide-react dependency). 24x24 viewBox, stroke 2,
// round caps/joins, fill none — rendered at 18px via width/height while the viewBox
// and stroke-width stay at design scale so the strokes don't get proportionally thin.
// Color is inherited from the parent's `color` via `currentColor`, so a tab button
// just sets its own `color` style and the icon follows (muted inactive / white active).

import type { ReactNode } from 'react'

function IconBase({ children }: { children: ReactNode }) {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  )
}

export function DashboardIcon() {
  return <IconBase><polyline points="3 12 8 12 10 6 14 18 16 12 21 12" /></IconBase>
}

export function ReportsIcon() {
  return (
    <IconBase>
      <path d="M6 2h9l5 5v15H6z" />
      <path d="M15 2v5h5" />
      <line x1="9" y1="13" x2="17" y2="13" />
      <line x1="9" y1="17" x2="17" y2="17" />
    </IconBase>
  )
}

export function CompareIcon() {
  return (
    <IconBase>
      <polyline points="16 3 20 7 16 11" />
      <path d="M4 7h16" />
      <polyline points="8 21 4 17 8 13" />
      <path d="M20 17H4" />
    </IconBase>
  )
}

export function AnomaliesIcon() {
  return (
    <IconBase>
      <path d="M12 3 2 20h20L12 3z" />
      <line x1="12" y1="10" x2="12" y2="15" />
      <line x1="12" y1="18" x2="12.01" y2="18" />
    </IconBase>
  )
}

export function StatusIcon() {
  return <IconBase><polygon points="13 2 3 14 11 14 9 22 21 10 13 10 13 2" /></IconBase>
}

export function DevIcon() {
  return (
    <IconBase>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <polyline points="7 9 10 12 7 15" />
      <line x1="12" y1="15" x2="17" y2="15" />
    </IconBase>
  )
}

export function NetworksIcon() {
  return (
    <IconBase>
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15 15 0 0 1 0 20a15 15 0 0 1 0-20z" />
    </IconBase>
  )
}

export function MemosIcon() {
  return <IconBase><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></IconBase>
}

export function BatchesIcon() {
  return (
    <IconBase>
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 12 12 17 22 12" />
      <polyline points="2 17 12 22 22 17" />
    </IconBase>
  )
}

export function ChainlinkIcon() {
  return (
    <IconBase>
      <path d="M9 15 15 9" />
      <path d="M13 4h3a5 5 0 0 1 0 10h-3" />
      <path d="M11 20H8a5 5 0 0 1 0-10h3" />
    </IconBase>
  )
}

// GitHub's mark is a solid silhouette, not a line drawing, so this one breaks from
// IconBase (fill instead of stroke) — same 24x24/18px sizing convention as the rest.
export function GitHubIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.026 2.747-1.026.546 1.378.202 2.397.1 2.65.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  )
}
