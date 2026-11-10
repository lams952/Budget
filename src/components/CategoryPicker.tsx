import { categoriesFor } from '../lib/categories'
import type { TxType } from '../lib/types'

export function CategoryPicker({ type, value, onChange }: { type: TxType; value: string; onChange: (id: string) => void }) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {categoriesFor(type).map((c) => (
        <button
          key={c.id}
          onClick={() => onChange(c.id)}
          aria-pressed={value === c.id}
          className={`press flex flex-col items-center gap-1 rounded-2xl px-1 py-2.5 text-[11px] leading-tight font-medium transition ${value === c.id ? 'bg-accent/12 text-accent ring-2 ring-accent' : 'bg-field'}`}
        >
          <span className="text-[20px]">{c.emoji}</span>
          <span className="line-clamp-2 text-center">{c.label}</span>
        </button>
      ))}
    </div>
  )
}
