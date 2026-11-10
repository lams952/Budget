import { forwardRef, useMemo, useState } from 'react'
import { useData, useStore } from '../hooks/data'
import { getCategory } from '../lib/categories'
import { addDays, toKey } from '../lib/dates'
import { dateLabel } from '../lib/dateLabel'
import { money } from '../lib/format'
import { categorize, learnKey } from '../lib/smart/categorizer'
import { normalize } from '../lib/smart/normalize'
import { parseQuickInput } from '../lib/smart/parser'
import type { Transaction, TxType } from '../lib/types'
import { CategoryPicker } from './CategoryPicker'
import { Sheet } from './ui'

interface Props {
  open: boolean
  onClose: () => void
  onSaved: (msg: string) => void
}

/** Suggestions : les dépenses les plus fréquentes des 60 derniers jours. */
function useFrequent(transactions: Transaction[]) {
  return useMemo(() => {
    const since = toKey(addDays(new Date(), -60))
    const groups = new Map<string, { label: string; amounts: Map<number, number>; count: number; type: TxType }>()
    for (const t of transactions) {
      if (t.date < since || t.recurringId || !t.label) continue
      const k = normalize(t.label)
      const g = groups.get(k) ?? { label: t.label, amounts: new Map(), count: 0, type: t.type }
      g.count++
      g.amounts.set(t.amount, (g.amounts.get(t.amount) ?? 0) + 1)
      groups.set(k, g)
    }
    return [...groups.values()]
      .filter((g) => g.count >= 2)
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)
      .map((g) => {
        const amount = [...g.amounts.entries()].sort((a, b) => b[1] - a[1])[0][0]
        return { label: g.label, amount, type: g.type }
      })
  }, [transactions])
}

const fmtInput = (n: number) => String(n).replace('.', ',')

export const QuickAddSheet = forwardRef<HTMLInputElement, Props>(function QuickAddSheet({ open, onClose, onSaved }, inputRef) {
  const store = useStore()
  const { learned, transactions } = useData()
  const [text, setText] = useState('')
  const [override, setOverride] = useState<{ category?: string; date?: string; type?: TxType }>({})
  const [picking, setPicking] = useState(false)
  const frequent = useFrequent(transactions)

  const parsed = parseQuickInput(text)
  const type = override.type ?? parsed.type
  const guess = categorize(parsed.label, type, learned)
  const category = override.category && getCategory(override.category).type === type ? override.category : guess.category
  const date = override.date ?? parsed.date
  const valid = parsed.amount !== null && parsed.amount > 0

  const reset = () => {
    setText('')
    setOverride({})
    setPicking(false)
  }
  const close = () => {
    ;(document.activeElement as HTMLElement | null)?.blur()
    onClose()
    setTimeout(reset, 300)
  }
  const save = () => {
    if (!valid) return
    const label = parsed.label || getCategory(category).label
    store.addTransactions([{ amount: parsed.amount!, type, category, label, date }])
    // l'app apprend des corrections
    if (parsed.label && category !== guess.category) store.learn(learnKey(parsed.label), category)
    onSaved(`${type === 'income' ? 'Revenu' : 'Dépense'} ajouté${type === 'income' ? '' : 'e'} ✓`)
    close()
  }

  const cat = getCategory(category)

  return (
    <Sheet open={open} onClose={close}>
      <div className="px-5 pt-4 pb-3">
        {/* aperçu */}
        <div className="text-center">
          <div className={`tabular text-[52px] leading-none font-semibold tracking-tight ${valid ? (type === 'income' ? 'text-good' : '') : 'text-card2'}`}>
            {valid ? `${type === 'income' ? '+' : ''}${money(parsed.amount!)}` : '0,00 €'}
          </div>
          <div className="mt-2 h-5 truncate text-[15px] text-muted">{parsed.label || (text ? '' : 'Tape le montant et une description')}</div>
        </div>

        {/* puces modifiables */}
        <div className="mt-5 flex flex-wrap items-center justify-center gap-1.5">
          <button
            onClick={() => setPicking((p) => !p)}
            className={`press flex items-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-medium ${picking ? 'bg-ink text-bg' : 'bg-field'}`}
          >
            <span>{cat.emoji}</span>
            {cat.label}
            {guess.confidence === 'learned' && !override.category && <span className="text-[11px] opacity-60">✦</span>}
          </button>
          <label className="press relative flex items-center rounded-full bg-field px-3 py-2 text-[13px] font-medium">
            📅 {dateLabel(date)}
            <input
              type="date"
              value={date}
              max={toKey(new Date())}
              onChange={(e) => e.target.value && setOverride((o) => ({ ...o, date: e.target.value }))}
              className="absolute inset-0 opacity-0"
              aria-label="Date"
            />
          </label>
          <button
            onClick={() => setOverride((o) => ({ ...o, type: type === 'income' ? 'expense' : 'income', category: undefined }))}
            className={`press rounded-full px-3 py-2 text-[13px] font-medium ${type === 'income' ? 'bg-good/15 text-good' : 'bg-field'}`}
          >
            {type === 'income' ? 'Revenu' : 'Dépense'}
          </button>
        </div>

        {picking && (
          <div className="fade-up mt-4">
            <CategoryPicker
              type={type}
              value={category}
              onChange={(id) => {
                setOverride((o) => ({ ...o, category: id }))
                setPicking(false)
              }}
            />
          </div>
        )}

        {/* suggestions intelligentes */}
        {!text && frequent.length > 0 && !picking && (
          <div className="no-scrollbar -mx-5 mt-5 flex gap-2 overflow-x-auto px-5">
            {frequent.map((f) => (
              <button
                key={f.label}
                onClick={() => setText(`${f.type === 'income' ? '+' : ''}${fmtInput(f.amount)} ${f.label}`)}
                className="press shrink-0 rounded-full border border-line px-3.5 py-2 text-[14px] whitespace-nowrap"
              >
                {f.label} <span className="text-muted">{money(f.amount)}</span>
              </button>
            ))}
          </div>
        )}

        {/* saisie */}
        <form
          className="mt-5 flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            save()
          }}
        >
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="12,50 boulangerie hier"
            enterKeyHint="done"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            className="min-w-0 flex-1 rounded-full bg-field px-5 py-3.5 text-[17px] outline-none placeholder:text-muted"
          />
          <button
            type="submit"
            disabled={!valid}
            aria-label="Ajouter"
            className="press flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-full bg-ink text-bg transition disabled:opacity-20"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          </button>
        </form>
        {!text && <p className="mt-3 text-center text-[12px] text-muted">« 45 essence hier » · « +1800 salaire » · « 9,90 ciné samedi »</p>}
      </div>
    </Sheet>
  )
})
