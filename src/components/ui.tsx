import { useEffect, useState, type ReactNode } from 'react'
import { getCategory } from '../lib/categories'

/** Hauteur du clavier iOS (via visualViewport) pour garder les feuilles visibles. */
export function useKeyboardInset() {
  const [inset, setInset] = useState(0)
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const update = () => setInset(Math.max(0, window.innerHeight - vv.height - vv.offsetTop))
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])
  return inset
}

export function Sheet({ open, onClose, title, children, right }: { open: boolean; onClose: () => void; title?: string; children: ReactNode; right?: ReactNode }) {
  const kb = useKeyboardInset()
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  return (
    <div className={`fixed inset-0 z-40 ${open ? '' : 'pointer-events-none'}`} aria-hidden={!open}>
      <div onClick={onClose} className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0'}`} />
      <div
        role="dialog"
        aria-modal="true"
        style={{ bottom: open ? kb : 0, maxHeight: `calc(100% - ${kb}px - env(safe-area-inset-top) - 16px)` }}
        className={`absolute inset-x-0 mx-auto flex max-w-lg flex-col rounded-t-[28px] bg-sheet shadow-2xl transition-transform duration-300 ease-out ${open ? 'translate-y-0' : 'translate-y-[110%]'} ${kb ? '' : 'pb-safe'}`}
      >
        <div className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-card2" />
        {title !== undefined && (
          <div className="flex shrink-0 items-center justify-between px-5 pt-3 pb-2">
            <button onClick={onClose} className="press text-[17px] text-accent">Annuler</button>
            <h2 className="text-[17px] font-semibold">{title}</h2>
            <div className="min-w-14 text-right">{right}</div>
          </div>
        )}
        <div className="no-scrollbar min-h-0 overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-3xl bg-card p-5 ${className}`}>{children}</div>
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mt-8 mb-3 flex items-baseline justify-between px-1">
      <h2 className="text-[20px] font-semibold tracking-tight">{children}</h2>
      {action}
    </div>
  )
}

export function CategoryIcon({ id, size = 40 }: { id: string; size?: number }) {
  const c = getCategory(id)
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full"
      style={{ width: size, height: size, background: `${c.color}22`, fontSize: size * 0.45 }}
      aria-hidden
    >
      {c.emoji}
    </div>
  )
}

export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div className="flex rounded-xl bg-field p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`flex-1 rounded-[10px] px-3 py-1.5 text-[14px] font-medium transition ${value === o.value ? 'bg-bg shadow-sm dark:bg-card2' : 'text-muted'}`}
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
      className={`press w-full rounded-2xl bg-ink py-4 text-[17px] font-semibold text-bg disabled:opacity-30 ${className}`}
    >
      {children}
    </button>
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block px-1 text-[13px] text-muted">{label}</span>
      {children}
    </label>
  )
}

export const inputClass = 'w-full rounded-2xl bg-field px-4 py-3.5 text-[17px] outline-none placeholder:text-muted'

export function Toast({ message }: { message: string | null }) {
  return (
    <div className={`pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center pt-safe transition-all duration-300 ${message ? 'translate-y-2 opacity-100' : '-translate-y-4 opacity-0'}`}>
      <div className="rounded-full bg-ink px-4 py-2 text-[15px] font-medium text-bg shadow-lg">{message}</div>
    </div>
  )
}
