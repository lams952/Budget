import { addMonths, daysInMonth, monthKey, monthOf } from '../dates'
import type { Recurring, Transaction } from '../types'
import { normalize } from './normalize'

export const recurringTxId = (r: Recurring, month: string) => `rec_${r.id}_${month}`

/**
 * Transactions à créer pour les récurrentes arrivées à échéance.
 * Idempotent : identifiant déterministe + `lastGenerated` (une transaction supprimée n'est pas recréée).
 */
export function dueRecurring(recurring: Recurring[], existing: Transaction[], today = new Date()) {
  const current = monthKey(today)
  const ids = new Set(existing.map((t) => t.id))
  const toCreate: Transaction[] = []
  const updates: { id: string; lastGenerated: string }[] = []

  for (const r of recurring) {
    if (!r.active) continue
    let m = r.lastGenerated ? addMonths(r.lastGenerated, 1) : r.startMonth
    // jamais plus de 12 mois de rattrapage
    if (m < addMonths(current, -11)) m = addMonths(current, -11)
    let last: string | undefined
    while (m <= current) {
      const day = Math.min(r.dayOfMonth, daysInMonth(m))
      if (m === current && day > today.getDate()) break
      const id = recurringTxId(r, m)
      if (!ids.has(id)) {
        toCreate.push({
          id,
          amount: r.amount,
          type: r.type,
          category: r.category,
          label: r.label,
          date: `${m}-${String(day).padStart(2, '0')}`,
          recurringId: r.id,
          createdAt: Date.now(),
        })
      }
      last = m
      m = addMonths(m, 1)
    }
    if (last) updates.push({ id: r.id, lastGenerated: last })
  }
  return { toCreate, updates }
}

export interface RecurringSuggestion {
  key: string
  label: string
  amount: number
  category: string
  dayOfMonth: number
  months: number
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

/** Repère les dépenses qui reviennent chaque mois (même libellé, montant proche, même période du mois). */
export function detectRecurring(
  transactions: Transaction[],
  recurring: Recurring[],
  dismissed: string[] = [],
  today = new Date(),
): RecurringSuggestion[] {
  const since = addMonths(monthKey(today), -4)
  const known = new Set([...recurring.map((r) => normalize(r.label)), ...dismissed])
  const groups = new Map<string, Transaction[]>()
  for (const t of transactions) {
    if (t.type !== 'expense' || t.recurringId || monthOf(t.date) < since) continue
    const key = normalize(t.label)
    if (!key || known.has(key)) continue
    groups.set(key, [...(groups.get(key) ?? []), t])
  }

  const out: RecurringSuggestion[] = []
  for (const [key, txs] of groups) {
    const months = new Set(txs.map((t) => monthOf(t.date)))
    if (months.size < 2 || txs.length > months.size + 1) continue // trop fréquent = pas un abonnement
    const amounts = txs.map((t) => t.amount)
    const med = median(amounts)
    if (!amounts.every((a) => Math.abs(a - med) <= med * 0.1)) continue
    const days = txs.map((t) => Number(t.date.slice(8, 10)))
    if (Math.max(...days) - Math.min(...days) > 6) continue
    const latest = txs.reduce((a, b) => (a.date > b.date ? a : b))
    out.push({
      key,
      label: latest.label,
      amount: Math.round(med * 100) / 100,
      category: latest.category,
      dayOfMonth: Math.round(median(days)),
      months: months.size,
    })
  }
  return out.sort((a, b) => b.amount - a.amount)
}
