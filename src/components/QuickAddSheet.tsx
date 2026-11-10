import { useEffect, useMemo, useRef, useState } from 'react'
import { useData, useStore } from '../hooks/data'
import { categoriesFor, getCategory } from '../lib/categories'
import { addDays, toKey } from '../lib/dates'
import { dateLabel } from '../lib/dateLabel'
import { money } from '../lib/format'
import { newId } from '../data/store'
import { useUI } from '../hooks/ui'
import { categorize, learnFromHistory, learnKey } from '../lib/smart/categorizer'
import { normalize } from '../lib/smart/normalize'
import { parseQuickInput } from '../lib/smart/parser'
import type { Transaction, TxType } from '../lib/types'
import { Icon, Sheet } from './ui'

interface Props {
  open: boolean
  onClose: () => void
}

interface Habit {
  key: string
  label: string
  amount: number
  type: TxType
  count: number
}

/** Habitudes : libellés saisis ces 4 derniers mois, avec leur montant le plus courant. */
function useHabits(transactions: Transaction[]): Habit[] {
  return useMemo(() => {
    const since = toKey(addDays(new Date(), -120))
    const groups = new Map<string, { label: string; amounts: Map<number, number>; count: number; type: TxType }>()
    for (const t of transactions) {
      if (t.date < since || t.recurringId || !t.label) continue
      const k = normalize(t.label)
      if (!k) continue
      const g = groups.get(k) ?? { label: t.label, amounts: new Map(), count: 0, type: t.type }
      g.count++
      g.amounts.set(t.amount, (g.amounts.get(t.amount) ?? 0) + 1)
      groups.set(k, g)
    }
    return [...groups.entries()]
      .map(([key, g]) => ({ key, label: g.label, type: g.type, count: g.count, amount: [...g.amounts.entries()].sort((a, b) => b[1] - a[1])[0][0] }))
      .sort((a, b) => b.count - a.count)
  }, [transactions])
}

const fmtInput = (n: number) => String(n).replace('.', ',')

export function QuickAddSheet({ open, onClose }: Props) {
  const store = useStore()
  const { learned, transactions } = useData()
  const [text, setText] = useState('')
  const [override, setOverride] = useState<{ category?: string; date?: string; type?: TxType }>({})
  const [picking, setPicking] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const { toast } = useUI()
  const habits = useHabits(transactions)
  // ce que l'utilisateur a corrigé explicitement prime sur ce qu'on déduit de l'historique
  const knowledge = useMemo(() => ({ ...learnFromHistory(transactions), ...learned }), [transactions, learned])

  // Le clavier est déjà ouvert (champ relais focalisé pendant le tap sur +) :
  // on bascule le focus sur le vrai champ une fois la feuille à l'écran.
  useEffect(() => {
    if (!open) return
    const id = requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }))
    return () => cancelAnimationFrame(id)
  }, [open])

  const parsed = parseQuickInput(text)
  const type = override.type ?? parsed.type
  const guess = categorize(parsed.label, type, knowledge)
  const category = override.category && getCategory(override.category).type === type ? override.category : guess.category
  const date = override.date ?? parsed.date
  const valid = parsed.amount !== null && parsed.amount > 0
  const cat = getCategory(category)

  // Suggestions : les habitudes les plus fréquentes, ou celles qui complètent ce qui est en train d'être tapé.
  const typed = normalize(parsed.label)
  const suggestions = !text.trim()
    ? habits.filter((h) => h.count >= 2).slice(0, 8)
    : typed
      ? habits.filter((h) => (h.key.startsWith(typed) || h.key.includes(` ${typed}`)) && !(h.key === typed && parsed.amount !== null)).slice(0, 6)
      : []
  const applyHabit = (h: Habit) => {
    const amount = parsed.amount ?? h.amount
    const income = (override.type ?? (parsed.amount !== null ? parsed.type : h.type)) === 'income'
    if (parsed.date !== toKey(new Date())) setOverride((o) => ({ date: parsed.date, ...o }))
    setText(`${income ? '+' : ''}${fmtInput(amount)} ${h.label}`)
    inputRef.current?.focus({ preventScroll: true })
  }

  const reset = () => {
    setText('')
    setOverride({})
    setPicking(false)
  }
  const close = () => {
    inputRef.current?.blur()
    onClose()
    setTimeout(reset, 350)
  }
  const save = () => {
    if (!valid) return
    const label = parsed.label || cat.label
    const id = newId()
    store.addTransactions([{ id, amount: parsed.amount!, type, category, label, date }])
    // l'app apprend des corrections
    if (parsed.label && category !== guess.category) store.learn(learnKey(parsed.label), category)
    toast(`${type === 'income' ? '+' : '−'}${money(parsed.amount!)} · ${label}`, { label: 'Annuler', run: () => store.deleteTransaction(id) })
    close()
  }

  const chip = 'press flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-[14px] font-semibold whitespace-nowrap'

  return (
    <Sheet open={open} onClose={close}>
      <div className="px-5 pb-3">
        {/* aperçu */}
        <div className="text-center">
          <div className={`num text-[52px] leading-none font-bold transition-colors ${valid ? (type === 'income' ? 'text-good' : '') : 'text-card2'}`}>
            {valid ? `${type === 'income' ? '+' : ''}${money(parsed.amount!)}` : '0,00 €'}
          </div>
          <div className="mt-2 h-5 truncate text-[15px] text-muted">{parsed.label || (text ? '' : 'Tape un montant et une description')}</div>
        </div>

        {/* puces modifiables : une seule ligne, défilable */}
        <div className="no-scrollbar -mx-5 mt-4 flex gap-2 overflow-x-auto px-5">
          <button onClick={() => setPicking((p) => !p)} className={`${chip} ${picking ? 'bg-accent text-white' : 'bg-field'}`} aria-expanded={picking}>
            <span>{cat.emoji}</span>
            {cat.label}
            {guess.confidence === 'learned' && !override.category && <Icon name="sparkle" size={13} className="text-accent" />}
          </button>
          <label className={`${chip} relative bg-field`}>
            {dateLabel(date)}
            <input
              type="date"
              value={date}
              max={toKey(new Date())}
              onChange={(e) => e.target.value && setOverride((o) => ({ ...o, date: e.target.value }))}
              className="absolute inset-0 !min-h-0 opacity-0"
              aria-label="Date"
            />
          </label>
          <button
            onClick={() => setOverride((o) => ({ ...o, type: type === 'income' ? 'expense' : 'income', category: undefined }))}
            className={`${chip} ${type === 'income' ? 'bg-good/15 text-good' : 'bg-field'}`}
            aria-label={`Type : ${type === 'income' ? 'revenu' : 'dépense'}. Appuyer pour changer.`}
          >
            <Icon name="repeat" size={13} className="opacity-60" />
            {type === 'income' ? 'Revenu' : 'Dépense'}
          </button>
        </div>

        {/* choix de catégorie (ou suggestions) : une ligne horizontale, pour rester compact au-dessus du clavier */}
        {picking ? (
          <div className="fade-up no-scrollbar -mx-5 mt-2 flex gap-2 overflow-x-auto px-5">
            {categoriesFor(type).map((c) => (
              <button
                key={c.id}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setOverride((o) => ({ ...o, category: c.id }))
                  setPicking(false)
                }}
                className={`${chip} ${c.id === category ? 'bg-accent text-white' : 'border border-line'}`}
              >
                <span>{c.emoji}</span>
                {c.label}
              </button>
            ))}
          </div>
        ) : (
          suggestions.length > 0 && (
            <div className="no-scrollbar -mx-5 mt-2 flex gap-2 overflow-x-auto px-5">
              {suggestions.map((h) => (
                <button key={h.key} onMouseDown={(e) => e.preventDefault()} onClick={() => applyHabit(h)} className={`${chip} border border-line !font-medium`}>
                  {h.label} <span className="num text-muted">{money(parsed.amount ?? h.amount)}</span>
                </button>
              ))}
            </div>
          )
        )}

        {/* saisie */}
        <form
          className="mt-4 flex items-center gap-2"
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
            autoCapitalize="off"
            spellCheck={false}
            aria-label="Montant et description"
            className="min-w-0 flex-1 rounded-full bg-field px-5 py-3.5 text-[17px] outline-none transition-shadow placeholder:text-muted focus:ring-2 focus:ring-accent/40"
          />
          <button
            type="submit"
            disabled={!valid}
            onMouseDown={(e) => e.preventDefault()}
            aria-label="Ajouter"
            className="press accent-grad flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-full transition-opacity disabled:opacity-25"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          </button>
        </form>
        {!text && !picking && <p className="mt-2.5 text-center text-[12px] text-muted">« 45 essence hier » · « +1800 salaire » · « 9,90 ciné samedi »</p>}
        {text.trim() !== '' && !valid && <p className="mt-2.5 text-center text-[12px] text-muted">Ajoute un montant pour enregistrer.</p>}
      </div>
    </Sheet>
  )
}
