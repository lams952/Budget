import { useEffect, useRef, useState, type ReactNode } from 'react'
import { getCategory } from '../lib/categories'

/**
 * Zone réellement visible (au-dessus du clavier iOS). On y ancre les feuilles
 * pour qu'elles restent collées au clavier, même quand Safari décale la page.
 */
export function useVisualViewport() {
  const read = () => {
    const vv = window.visualViewport
    return { top: vv?.offsetTop ?? 0, height: vv?.height ?? window.innerHeight, keyboard: vv ? window.innerHeight - vv.height > 120 : false }
  }
  const [state, setState] = useState(read)
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    let raf = 0
    const update = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => setState(read()))
    }
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      cancelAnimationFrame(raf)
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])
  return state
}

/** Feuille modale façon iOS : glisser vers le bas pour fermer, toujours au-dessus du clavier. */
export function Sheet({ open, onClose, title, children, right }: { open: boolean; onClose: () => void; title?: string; children: ReactNode; right?: ReactNode }) {
  const vv = useVisualViewport()
  const [drag, setDrag] = useState(0)
  const start = useRef<{ y: number; t: number } | null>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const dragHandlers = {
    onTouchStart: (e: React.TouchEvent) => {
      start.current = { y: e.touches[0].clientY, t: Date.now() }
    },
    onTouchMove: (e: React.TouchEvent) => {
      if (start.current) setDrag(Math.max(0, e.touches[0].clientY - start.current.y))
    },
    onTouchEnd: () => {
      const s = start.current
      start.current = null
      if (!s) return
      const fast = drag / Math.max(Date.now() - s.t, 1) > 0.5
      if (drag > 90 || (fast && drag > 20)) onClose()
      setDrag(0)
    },
  }

  return (
    <div
      className={`fixed inset-x-0 z-40 ${open ? '' : 'pointer-events-none'}`}
      style={{ top: vv.top, height: vv.height }}
      aria-hidden={!open}
      inert={!open}
    >
      {/* iOS n'envoie pas toujours de « click » sur un simple div quand le clavier est ouvert :
          on ferme dès le relâchement du doigt, et preventDefault évite un clic fantôme sur l'écran dessous. */}
      <div
        onClick={onClose}
        onTouchEnd={(e) => {
          e.preventDefault()
          onClose()
        }}
        className={`absolute inset-0 cursor-pointer touch-none bg-black/45 backdrop-blur-[2px] transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0'}`}
        style={{ opacity: open ? Math.max(0.2, 1 - drag / 400) : 0 }}
      />
      <div
        role="dialog"
        aria-modal="true"
        style={{
          maxHeight: 'calc(100% - env(safe-area-inset-top) - 12px)',
          transform: open ? `translateY(${drag}px)` : 'translateY(105%)',
          transition: drag ? 'none' : 'transform 0.38s cubic-bezier(0.32, 0.72, 0, 1)',
        }}
        className={`absolute inset-x-0 bottom-0 mx-auto flex max-w-lg flex-col rounded-t-[30px] bg-sheet shadow-[0_-12px_40px_-12px_rgba(0,0,0,0.35)] will-change-transform ${vv.keyboard ? 'pb-2' : 'pb-safe'}`}
      >
        <div {...dragHandlers} className="shrink-0 touch-none">
          <div className="mx-auto mt-2.5 h-[5px] w-9 rounded-full bg-card2" />
          {title !== undefined && (
            <div className="flex items-center justify-between px-5 pt-3 pb-2">
              <button onClick={onClose} className="press min-w-16 text-left text-[16px] text-muted">
                Annuler
              </button>
              <h2 className="text-[17px] font-semibold">{title}</h2>
              <div className="min-w-16 text-right">{right}</div>
            </div>
          )}
          {title === undefined && <div className="h-3" />}
        </div>
        <div className="scroller min-h-0">{children}</div>
      </div>
    </div>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`card rounded-3xl p-5 ${className}`}>{children}</div>
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mt-8 mb-2.5 flex items-baseline justify-between px-1">
      <h2 className="text-[13px] font-semibold tracking-wide text-muted uppercase">{children}</h2>
      {action}
    </div>
  )
}

export function ScreenTitle({ children, sub, right }: { children: ReactNode; sub?: ReactNode; right?: ReactNode }) {
  return (
    <header className="flex items-end justify-between px-1 pt-3">
      <div className="min-w-0">
        {sub && <p className="text-[13px] font-semibold tracking-wide text-muted uppercase">{sub}</p>}
        <h1 className="display text-[32px] leading-tight font-bold">{children}</h1>
      </div>
      {right}
    </header>
  )
}

const ICONS = {
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4',
  close: 'M6 6l12 12M18 6 6 18',
  chevronRight: 'M9 5l7 7-7 7',
  chevronLeft: 'M15 5l-7 7 7 7',
  plus: 'M12 5v14M5 12h14',
  repeat: 'M17 2l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 22l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3',
  sparkle: 'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z',
  cloud: 'M7 18a4 4 0 0 1-.6-7.96A6 6 0 0 1 18 9.5a4.25 4.25 0 0 1 .5 8.5z',
  cloudOff: 'M3 3l18 18M7 18a4 4 0 0 1-1.7-7.6M9.4 5.5A6 6 0 0 1 18 9.5a4.25 4.25 0 0 1 2.6 7.4M18 18H7',
  eye: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  eyeOff: 'M3 3l18 18M10.6 5.1A10.6 10.6 0 0 1 12 5c6.4 0 10 7 10 7a17.6 17.6 0 0 1-3.1 3.9M6.5 6.6C3.7 8.4 2 12 2 12s3.6 7 10 7a10 10 0 0 0 4.3-1M9.9 9.9a3 3 0 0 0 4.2 4.2',
  download: 'M12 3v12M7 10l5 5 5-5M4 20h16',
  upload: 'M12 16V4M7 9l5-5 5 5M4 20h16',
  table: 'M4 5h16v14H4zM4 10h16M10 5v14',
  logout: 'M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h10',
  arrowUp: 'M12 19V5M5 12l7-7 7 7',
  copy: 'M9 9h10v11H9zM5 15V4h10',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  check: 'M5 12.5l4.5 4.5L19 7.5',
} as const

export function Icon({ name, size = 20, strokeWidth = 2, className = '' }: { name: keyof typeof ICONS; size?: number; strokeWidth?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 ${className}`} aria-hidden>
      <path d={ICONS[name]} />
    </svg>
  )
}

export function CategoryIcon({ id, size = 40 }: { id: string; size?: number }) {
  const c = getCategory(id)
  return (
    <div
      className="flex shrink-0 items-center justify-center"
      style={{ width: size, height: size, borderRadius: size * 0.32, background: `${c.color}24`, fontSize: size * 0.46 }}
      aria-hidden
    >
      {c.emoji}
    </div>
  )
}

export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div className="flex rounded-[14px] bg-field p-[3px]" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={`flex-1 rounded-[11px] px-3 py-1.5 text-[14px] font-semibold transition ${value === o.value ? 'bg-raise text-ink shadow-[0_1px_3px_rgba(0,0,0,0.12)]' : 'text-muted'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function PrimaryButton({ children, onClick, disabled, type = 'button', className = '' }: { children: ReactNode; onClick?: () => void; disabled?: boolean; type?: 'button' | 'submit'; className?: string }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`press accent-grad w-full rounded-2xl py-4 text-[17px] font-semibold disabled:opacity-35 ${className}`}
    >
      {children}
    </button>
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block px-1 text-[13px] font-medium text-muted">{label}</span>
      {children}
    </label>
  )
}

export const inputClass = 'w-full rounded-2xl bg-field px-4 py-3.5 text-[17px] outline-none placeholder:text-muted focus:ring-2 focus:ring-accent/40 transition-shadow'

/** Convertit une saisie « 1 250,50 » en nombre (NaN si invalide). */
export const parseAmount = (s: string) => {
  const v = Number(s.replace(/[\s  €]/g, '').replace(',', '.'))
  return s.trim() ? v : NaN
}

export interface ToastData {
  message: string
  action?: { label: string; run: () => void }
}

export function Toast({ toast, onAction }: { toast: ToastData | null; onAction: () => void }) {
  // on garde le dernier contenu pendant l'animation de sortie
  const last = useRef<ToastData | null>(null)
  if (toast) last.current = toast
  const shown = toast ?? last.current
  return (
    <div role="status" className={`pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-safe transition-all duration-300 ${toast ? 'translate-y-2 opacity-100' : '-translate-y-6 opacity-0'}`}>
      <div className={`flex max-w-full items-center gap-3 rounded-full bg-ink py-2.5 pr-2.5 pl-4 text-[15px] font-medium text-bg shadow-xl ${toast ? 'pointer-events-auto' : ''}`}>
        <span className="truncate pr-1.5">{shown?.message}</span>
        {shown?.action && (
          <button onClick={onAction} className="press rounded-full bg-bg/15 px-3 py-1 text-[14px] font-semibold">
            {shown.action.label}
          </button>
        )}
      </div>
    </div>
  )
}

export interface ConfirmData {
  title: string
  text?: string
  confirm: string
  danger?: boolean
  run: () => void
}

/** Confirmation intégrée à l'app (remplace les boîtes de dialogue du navigateur). */
export function ConfirmSheet({ data, onClose }: { data: ConfirmData | null; onClose: () => void }) {
  const last = useRef<ConfirmData | null>(null)
  if (data) last.current = data
  const d = data ?? last.current
  return (
    <Sheet open={!!data} onClose={onClose}>
      <div className="px-5 pt-1 pb-4 text-center">
        <h2 className="display text-[20px] font-bold">{d?.title}</h2>
        {d?.text && <p className="mt-2 text-[15px] text-muted">{d.text}</p>}
        <button
          onClick={() => {
            d?.run()
            onClose()
          }}
          className={`press mt-5 w-full rounded-2xl py-3.5 text-[17px] font-semibold ${d?.danger ? 'bg-bad text-white' : 'accent-grad'}`}
        >
          {d?.confirm}
        </button>
        <button onClick={onClose} className="press mt-2 w-full rounded-2xl py-3 text-[16px] font-medium text-muted">
          Annuler
        </button>
      </div>
    </Sheet>
  )
}

export function EmptyState({ emoji, title, text, children }: { emoji: string; title: string; text?: string; children?: ReactNode }) {
  return (
    <div className="fade-up px-6 py-10 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-card2/70 text-[30px]">{emoji}</div>
      <p className="display mt-4 text-[18px] font-semibold">{title}</p>
      {text && <p className="mx-auto mt-1 max-w-[260px] text-[14px] text-muted">{text}</p>}
      {children}
    </div>
  )
}
