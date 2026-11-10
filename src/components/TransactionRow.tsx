import { memo, useRef } from 'react'
import { getCategory } from '../lib/categories'
import { money } from '../lib/format'
import type { Transaction } from '../lib/types'
import { CategoryIcon } from './ui'

export const TransactionRow = memo(function TransactionRow({ t, subtitle }: { t: Transaction; subtitle?: string }) {
  const cat = getCategory(t.category)
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <CategoryIcon id={t.category} size={42} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[16px] font-medium">{t.label || cat.label}</div>
        <div className="truncate text-[13px] text-muted">
          {subtitle ?? cat.label}
          {t.recurringId ? ' · charge fixe' : ''}
        </div>
      </div>
      <div className={`num text-[16px] font-medium ${t.type === 'income' ? 'text-good' : ''}`}>
        {t.type === 'income' ? '+' : '−'}
        {money(t.amount)}
      </div>
    </div>
  )
})

const OPEN = -88

/** Ligne qui révèle « Supprimer » en glissant vers la gauche ; un tap ouvre l'édition. Le geste n'implique aucun re-rendu. */
export function SwipeRow({ children, onTap, onDelete }: { children: React.ReactNode; onTap: () => void; onDelete: () => void }) {
  const content = useRef<HTMLDivElement>(null)
  const action = useRef<HTMLButtonElement>(null)
  const x = useRef(0)
  const g = useRef<{ x: number; y: number; base: number; dir: 'h' | 'v' | null; moved: boolean } | null>(null)

  const set = (dx: number, animate: boolean) => {
    x.current = dx
    if (content.current) {
      content.current.style.transition = animate ? 'transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)' : 'none'
      content.current.style.transform = dx ? `translateX(${dx}px)` : ''
    }
    if (action.current) {
      action.current.style.width = dx < 0 ? `${-dx + 1}px` : '0px'
      // les lignes sont translucides : le bouton doit être vraiment caché quand la ligne est fermée
      action.current.style.visibility = dx < 0 ? 'visible' : 'hidden'
      action.current.tabIndex = dx === 0 ? -1 : 0
    }
  }

  return (
    <div className="relative overflow-hidden">
      <button
        ref={action}
        onClick={onDelete}
        className="absolute inset-y-0 right-0 flex items-center justify-end overflow-hidden bg-bad pr-5 text-[15px] font-semibold whitespace-nowrap text-white"
        style={{ width: 0, visibility: 'hidden' }}
        tabIndex={-1}
      >
        Supprimer
      </button>
      <div
        ref={content}
        className="relative cursor-pointer will-change-transform"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onTap()
          }
        }}
        onTouchStart={(e) => {
          g.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, base: x.current, dir: null, moved: false }
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
            set(Math.min(0, Math.max(s.base + ddx, -window.innerWidth * 0.8)), false)
          }
        }}
        onTouchEnd={() => {
          const s = g.current
          if (!s || s.dir !== 'h') return
          if (x.current < -window.innerWidth * 0.5) {
            set(0, true)
            onDelete()
          } else set(x.current < OPEN / 2 ? OPEN : 0, true)
        }}
        onClick={() => {
          if (g.current?.moved) {
            g.current.moved = false
            return
          }
          if (x.current !== 0) set(0, true)
          else onTap()
        }}
      >
        {children}
      </div>
    </div>
  )
}
