import { categoriesFor } from '../lib/categories'
import type { TxType } from '../lib/types'

export function CategoryPicker({ type, value, onChange }: { type: TxType; value: string; onChange: (id: string) => void }) {
  return (
    <div className="grid grid-cols-5 gap-1.5">
      {categoriesFor(type).map((c) => (
        <button
          key={c.id}
          onClick={() => onChange(c.id)}
          aria-pressed={value === c.id}
          className={`press flex flex-col items-center gap-1 rounded-xl px-0.5 py-2 text-[10px] leading-tight font-medium transition ${value === c.id ? 'bg-accent/12 text-accent ring-2 ring-accent' : 'bg-field'}`}
        >
          <span className="text-[19px]">{c.emoji}</span>
          <span className="line-clamp-2 h-[24px] text-center">{c.label}</span>
        </button>
      ))}
    </div>
  )
}
