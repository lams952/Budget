import type { ReactNode } from 'react'

export function BudgetRing({ progress, color, size = 240, stroke = 14, children }: { progress: number; color: string; size?: number; stroke?: number; children: ReactNode }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const p = Math.min(Math.max(progress, 0), 1)
  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--card)" strokeWidth={stroke} />
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
          style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(.2,.8,.2,1), stroke 0.3s' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  )
}
