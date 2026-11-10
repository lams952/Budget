import type { ReactNode } from 'react'

export function Donut({ data, size = 200, stroke = 22, children }: { data: { value: number; color: string }[]; size?: number; stroke?: number; children?: ReactNode }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const total = data.reduce((s, d) => s + d.value, 0)
  const gap = data.length > 1 ? 3 : 0
  let offset = 0
  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--card)" strokeWidth={stroke} />
        {total > 0 &&
          data.map((d, i) => {
            const len = (d.value / total) * c
            const el = (
              <circle
                key={i}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={d.color}
                strokeWidth={stroke}
                strokeDasharray={`${Math.max(len - gap, 0.5)} ${c}`}
                strokeDashoffset={-offset}
              />
            )
            offset += len
            return el
          })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  )
}
