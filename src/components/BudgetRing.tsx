import type { ReactNode } from 'react'

/** Anneau de budget. `marker` (0..1) place un repère : là où l'on devrait en être à ce jour du mois. */
export function BudgetRing({ progress, color, marker, size = 212, stroke = 16, children }: { progress: number; color: string; marker?: number; size?: number; stroke?: number; children: ReactNode }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const p = Math.min(Math.max(progress, 0), 1)
  const a = marker === undefined ? 0 : Math.min(Math.max(marker, 0), 1) * 2 * Math.PI
  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - p)}
          style={{ transition: 'stroke-dashoffset 0.9s cubic-bezier(.2,.8,.2,1), stroke 0.3s', filter: `drop-shadow(0 0 10px ${color})` }}
        />
        {marker !== undefined && (
          <circle cx={size / 2 + r * Math.cos(a)} cy={size / 2 + r * Math.sin(a)} r={3.5} fill="#fff" stroke="rgba(0,0,0,0.35)" strokeWidth={1.5} />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  )
}
