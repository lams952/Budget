import type { Recurring, Transaction } from '../types'
import { daysInMonth, monthKey, monthOf } from '../dates'
import { normalize } from './normalize'

/**
 * Une dépense est une « charge fixe » si elle a été générée par une récurrente,
 * ou si elle porte le même libellé qu'une charge fixe déclarée (ex. loyer saisi à la main).
 * Les charges fixes sont HORS budget : le budget mensuel concerne les dépenses du quotidien.
 */
export function fixedMatcher(recurring: Pick<Recurring, 'label' | 'type'>[]) {
  const labels = new Set(recurring.filter((r) => r.type === 'expense').map((r) => normalize(r.label)))
  return (t: Transaction) => t.type === 'expense' && (!!t.recurringId || labels.has(normalize(t.label)))
}

export interface Upcoming {
  id: string
  label: string
  amount: number
  type: Recurring['type']
  category: string
  day: number
  inDays: number
}

/** Échéances déclarées (charges fixes et revenus) qui doivent encore tomber d'ici la fin du mois. */
export function upcomingThisMonth(recurring: Recurring[], transactions: Transaction[], today = new Date()): Upcoming[] {
  const month = monthKey(today)
  const dim = daysInMonth(month)
  const done = new Set<string>()
  for (const t of transactions) {
    if (monthOf(t.date) !== month) continue
    if (t.recurringId) done.add(t.recurringId)
    done.add(`${t.type}:${normalize(t.label)}`)
  }
  return recurring
    .filter((r) => r.active && (r.lastGenerated ?? '') < month && !done.has(r.id) && !done.has(`${r.type}:${normalize(r.label)}`))
    .map((r) => ({ id: r.id, label: r.label, amount: r.amount, type: r.type, category: r.category, day: Math.min(r.dayOfMonth, dim) }))
    .filter((r) => r.day > today.getDate())
    .map((r) => ({ ...r, inDays: r.day - today.getDate() }))
    .sort((a, b) => a.day - b.day)
}
