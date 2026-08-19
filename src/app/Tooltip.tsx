'use client'
// Reusable accessible tooltip (WAI-ARIA tooltip pattern): a small ⓘ trigger that
// shows its text on hover or keyboard focus, and dismisses on Escape. Portable —
// only touches `TEXT`/`SURFACES` tokens, so pointing it at a different theme file's
// equivalent tokens is the only change needed to reuse it in another project.
import { useId, useState, type KeyboardEvent } from 'react'
import { SURFACES, TEXT } from '@/lib/theme'

export function Tooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  const id = useId()

  function handleKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key === 'Escape') setOpen(false)
  }

  return (
    <span style={{ position: 'relative', display: 'inline-flex', verticalAlign: 'middle' }}>
      <button
        type="button"
        aria-describedby={open ? id : undefined}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={handleKeyDown}
        style={{
          background: 'none', border: 'none', padding: 0, margin: 0,
          color: TEXT.TERTIARY, fontSize: 13, lineHeight: 1, cursor: 'help',
        }}
      >
        ⓘ
      </button>
      {open && (
        <span
          id={id}
          role="tooltip"
          style={{
            position: 'absolute', bottom: '140%', left: '50%', transform: 'translateX(-50%)',
            background: SURFACES.BG_SURFACE, border: `1px solid ${SURFACES.BORDER}`,
            borderRadius: 8, padding: '8px 10px', fontSize: 12, color: TEXT.SECONDARY,
            width: 230, lineHeight: 1.5, zIndex: 20, pointerEvents: 'none',
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)', fontWeight: 400, textTransform: 'none',
            letterSpacing: 'normal',
          }}
        >
          {text}
        </span>
      )}
    </span>
  )
}
