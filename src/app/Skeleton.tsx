import { SURFACES } from '@/lib/theme'

// Shimmer keyframes are declared once, globally, in the <style> tag at the
// bottom of page.tsx (alongside the existing `pulse` animation).
export function Skeleton({ width = '60%', height = 16 }: { width?: number | string; height?: number }) {
  return (
    <span
      style={{
        display: 'inline-block',
        width, height,
        borderRadius: 4,
        background: `linear-gradient(90deg, ${SURFACES.BG_SURFACE} 25%, ${SURFACES.BORDER} 50%, ${SURFACES.BG_SURFACE} 75%)`,
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.4s ease-in-out infinite',
      }}
    />
  )
}
