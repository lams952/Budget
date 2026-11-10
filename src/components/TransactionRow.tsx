import { useRef, useState } from 'react'
import { getCategory } from '../lib/categories'
import { money } from '../lib/format'
import type { Transaction } from '../lib/types'
import { CategoryIcon } from './ui'

export function TransactionRow({ t, subtitle }: { t: Transaction; subtitle?: string }) {
  const cat = getCategory(t.category)
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <CategoryIcon id={t.category} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[16px] font-medium">{t.label || cat.label}</div>
        <div className="truncate text-[13px] text-muted">
          {subtitle ?? cat.label}
          {t.recurringId ? ' · charge fixe' : ''}
        </div>
      </div>
      <div className={`num text-[16px] font-semibold ${t.type === 'income' ? 'text-good' : ''}`}>
        {t.type === 'income' ? '+' : '−'}
        {money(t.amount)}
      </div>
    </div>
  )
}

const OPEN = -88

/** Ligne qui révèle « Supprimer » en glissant vers la gauche ; un tap ouvre l'édition. */
export function SwipeRow({ children, onTap, onDelete }: { children: React.ReactNode; onTap: () => void; onDelete: () => void }) {
  const [dx, setDx] = useState(0)
  const [dragging, setDragging] = useState(false)
  const g = useRef<{ x: number; y: number; base: number; dir: 'h' | 'v' | null; moved: boolean } | null>(null)

  return (
    <div className="relative overflow-hidden">
      <button
        onClick={onDelete}
        className="absolute inset-y-0 right-0 flex items-center justify-end bg-bad pr-5 text-[15px] font-semibold text-white"
        aria-hidden={dx === 0}
        style={{ width: Math.max(-dx, 0) + 1 }}
        tabIndex={dx === 0 ? -1 : 0}
      >
        Supprimer
      </button>
      <div
        className="relative cursor-pointer bg-card"
        style={{ transform: `translateX(${dx}px)`, transition: dragging ? 'none' : 'transform 0.25s ease' }}
        onTouchStart={(e) => {
          g.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, base: dx, dir: null, moved: false }
        }}
        onTouchMove={(e) => {
          const s = g.current
          if (!s) return
          const ddx = e.touches[0].clientX - s.x
          const ddy = e.touches[0].clientY - s.y
          if (!s.dir) {
            if (Math.abs(ddx) > 8 && Math.abs(ddx) > Math.abs(ddy)) s.dir = 'h'
            else if (Math.abs(ddy) > 8) s.dir = 'v'
          }
          if (s.dir === 'h') {
            s.moved = true
            setDragging(true)
            setDx(Math.min(0, Math.max(s.base + ddx, -window.innerWidth * 0.8)))
          }
        }}
        onTouchEnd={() => {
          const s = g.current
          setDragging(false)
          if (!s || s.dir !== 'h') return
          if (dx < -window.innerWidth * 0.5) {
            setDx(0)
            onDelete()
          } else setDx(dx < OPEN / 2 ? OPEN : 0)
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onTap()
          }
        }}
        onClick={() => {
          if (g.current?.moved) {
            g.current.moved = false
            return
          }
          if (dx !== 0) setDx(0)
          else onTap()
        }}
      >
        {children}
      </div>
    </div>
  )
}
