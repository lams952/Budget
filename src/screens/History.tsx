import { useMemo, useState } from 'react'
import { SwipeRow, TransactionRow } from '../components/TransactionRow'
import { inputClass } from '../components/ui'
import { useData, useStore } from '../hooks/data'
import { useUI } from '../hooks/ui'
import { getCategory } from '../lib/categories'
import { dateLabel } from '../lib/dateLabel'
import { money } from '../lib/format'
import { normalize } from '../lib/smart/normalize'

export function History({ onToast }: { onToast: (m: string) => void }) {
  const { transactions } = useData()
  const store = useStore()
  const { editTransaction } = useUI()
  const [q, setQ] = useState('')
  const [limit, setLimit] = useState(150)

  const filtered = useMemo(() => {
    const n = normalize(q)
    if (!n) return transactions
    return transactions.filter((t) => normalize(`${t.label} ${getCategory(t.category).label}`).includes(n) || String(t.amount).includes(q.replace(',', '.')))
  }, [transactions, q])

  const groups = useMemo(() => {
    const out: { date: string; items: typeof filtered; total: number }[] = []
    for (const t of filtered.slice(0, limit)) {
      let g = out[out.length - 1]
      if (!g || g.date !== t.date) out.push((g = { date: t.date, items: [], total: 0 }))
      g.items.push(t)
      g.total += t.type === 'expense' ? t.amount : 0
    }
    return out
  }, [filtered, limit])

  return (
    <div className="fade-up">
      <h1 className="px-1 pt-2 text-[34px] font-bold tracking-tight">Historique</h1>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍  Rechercher" className={`${inputClass} mt-4 !py-2.5`} type="search" />
      {groups.length === 0 && <p className="mt-16 text-center text-muted">{q ? 'Aucun résultat' : 'Rien pour le moment'}</p>}
      {groups.map((g) => (
        <section key={g.date} className="mt-6">
          <div className="mb-1 flex justify-between px-1 text-[13px] text-muted">
            <span className="font-medium uppercase">{dateLabel(g.date)}</span>
            {g.total > 0 && <span className="tabular">−{money(g.total)}</span>}
          </div>
          <div className="divide-y divide-line">
            {g.items.map((t) => (
              <SwipeRow
                key={t.id}
                onTap={() => editTransaction(t)}
                onDelete={() => {
                  store.deleteTransaction(t.id)
                  onToast('Supprimé')
                }}
              >
                <TransactionRow t={t} />
              </SwipeRow>
            ))}
          </div>
        </section>
      ))}
      {filtered.length > limit && (
        <button onClick={() => setLimit((l) => l + 150)} className="press mt-6 w-full py-3 text-accent">
          Afficher plus
        </button>
      )}
      {transactions.length > 0 && <p className="mt-6 text-center text-[12px] text-muted">Glisse une ligne vers la gauche pour la supprimer</p>}
    </div>
  )
}
