import { useEffect, useMemo, useState } from 'react'
import { SwipeRow, TransactionRow } from '../components/TransactionRow'
import { EmptyState, Icon, ScreenTitle, Segmented } from '../components/ui'
import { useData, useStore } from '../hooks/data'
import { useUI } from '../hooks/ui'
import { getCategory } from '../lib/categories'
import { dateLabel } from '../lib/dateLabel'
import { money } from '../lib/format'
import { normalize } from '../lib/smart/normalize'
import type { Transaction } from '../lib/types'

type Filter = 'all' | 'expense' | 'income'
const PAGE = 100

export function History() {
  const { transactions } = useData()
  const store = useStore()
  const { editTransaction, openQuickAdd, toast, search: q, setSearch: setQ } = useUI()
  const [filter, setFilter] = useState<Filter>('all')
  const [limit, setLimit] = useState(PAGE)

  // une nouvelle recherche repart du début de la liste
  useEffect(() => setLimit(PAGE), [q, filter])

  const filtered = useMemo(() => {
    const n = normalize(q)
    const num = q.trim().replace(',', '.')
    const isNum = /^\d+([.]\d*)?$/.test(num)
    return transactions.filter((t) => {
      if (filter !== 'all' && t.type !== filter) return false
      if (!q.trim()) return true
      if (isNum) return t.amount.toFixed(2).startsWith(num) || String(t.amount) === num
      return !!n && normalize(`${t.label} ${getCategory(t.category).label}`).includes(n)
    })
  }, [transactions, q, filter])

  const groups = useMemo(() => {
    const out: { date: string; items: Transaction[]; total: number }[] = []
    for (const t of filtered.slice(0, limit)) {
      let g = out[out.length - 1]
      if (!g || g.date !== t.date) out.push((g = { date: t.date, items: [], total: 0 }))
      g.items.push(t)
      g.total += t.type === 'expense' ? -t.amount : t.amount
    }
    return out
  }, [filtered, limit])

  const filtering = q.trim() !== '' || filter !== 'all'
  const net = useMemo(() => filtered.reduce((s, t) => s + (t.type === 'expense' ? -t.amount : t.amount), 0), [filtered])

  const remove = (t: Transaction) => {
    store.deleteTransaction(t.id)
    toast('Opération supprimée', { label: 'Annuler', run: () => store.addTransactions([t]) })
  }

  return (
    <div>
      <ScreenTitle>Historique</ScreenTitle>

      <div className="card mt-4 flex items-center gap-2.5 rounded-2xl px-3.5 focus-within:ring-2 focus-within:ring-accent/40">
        <Icon name="search" size={18} className="text-muted" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Libellé, catégorie ou montant"
          aria-label="Rechercher"
          type="search"
          enterKeyHint="search"
          autoComplete="off"
          autoCorrect="off"
          className="min-w-0 flex-1 bg-transparent py-3 text-[16px] outline-none placeholder:text-muted"
        />
        {q && (
          <button onClick={() => setQ('')} aria-label="Effacer la recherche" className="press flex h-6 w-6 items-center justify-center rounded-full bg-card2 text-muted">
            <Icon name="close" size={12} strokeWidth={3} />
          </button>
        )}
      </div>
      <div className="mt-2.5">
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'Tout' },
            { value: 'expense', label: 'Dépenses' },
            { value: 'income', label: 'Revenus' },
          ]}
        />
      </div>

      {filtering && filtered.length > 0 && (
        <p className="mt-4 px-1 text-[13px] text-muted">
          {filtered.length} opération{filtered.length > 1 ? 's' : ''} ·{' '}
          <span className="num font-semibold text-ink">
            {net > 0 ? '+' : net < 0 ? '−' : ''}
            {money(Math.abs(net))}
          </span>
        </p>
      )}

      {groups.length === 0 &&
        (filtering ? (
          <EmptyState emoji="🔍" title="Aucun résultat" text="Essaie un autre mot, une catégorie ou un montant.">
            <button
              onClick={() => {
                setQ('')
                setFilter('all')
              }}
              className="press mt-4 rounded-full bg-card2 px-4 py-2 text-[14px] font-semibold"
            >
              Tout afficher
            </button>
          </EmptyState>
        ) : (
          <EmptyState emoji="🗂️" title="Rien pour le moment" text="Tes opérations apparaîtront ici, classées par jour.">
            <button onClick={openQuickAdd} className="press accent-grad mt-5 rounded-full px-5 py-2.5 text-[15px] font-semibold">
              Ajouter une opération
            </button>
          </EmptyState>
        ))}

      {groups.map((g) => (
        <section key={g.date} className="mt-5">
          <div className="mb-2 flex items-baseline justify-between px-1 text-[13px] text-muted">
            <span className="font-semibold tracking-wide uppercase">{dateLabel(g.date)}</span>
            <span className={`num font-medium ${g.total > 0 ? 'text-good' : ''}`}>
              {g.total > 0 ? '+' : g.total < 0 ? '−' : ''}
              {money(Math.abs(g.total))}
            </span>
          </div>
          <div className="card divide-y divide-line overflow-hidden rounded-3xl">
            {g.items.map((t) => (
              <SwipeRow key={t.id} onTap={() => editTransaction(t)} onDelete={() => remove(t)}>
                <TransactionRow t={t} />
              </SwipeRow>
            ))}
          </div>
        </section>
      ))}

      {filtered.length > limit && (
        <button onClick={() => setLimit((l) => l + PAGE)} className="press card mt-5 w-full rounded-2xl py-3 text-[15px] font-semibold text-accent">
          Afficher plus ({filtered.length - limit} restantes)
        </button>
      )}
      {groups.length > 0 && <p className="mt-6 text-center text-[12px] text-muted">Touche une ligne pour la modifier · glisse à gauche pour la supprimer</p>}
    </div>
  )
}
