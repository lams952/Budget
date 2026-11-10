import { addMonths, daysInMonth, monthKey, monthOf, toKey } from '../dates'
import type { Recurring, Transaction } from '../types'
import { fixedMatcher } from './fixed'
import { normalize } from './normalize'

export interface ForecastHints {
  /** dépenses récurrentes détectées automatiquement (pas encore déclarées en charges fixes) */
  detected?: { key: string; amount: number; dayOfMonth: number }[]
}

export type BudgetStatus = 'ok' | 'warning' | 'over' | 'exceeded' | 'none'

export interface Forecast {
  /** dépenses du quotidien du mois (hors charges fixes) — c'est ce qui consomme le budget */
  spent: number
  /** charges fixes déjà passées / encore à venir ce mois-ci (hors budget) */
  fixedPaid: number
  fixedUpcoming: number
  income: number
  budget: number
  remaining: number
  /** ce qu'on peut dépenser par jour (aujourd'hui inclus) */
  perDay: number
  /** dépenses du quotidien prévues à la fin du mois */
  projected: number
  daysLeft: number // aujourd'hui inclus
  status: BudgetStatus
  progress: number // spent / budget
  /** part du mois écoulée (aujourd'hui inclus) : le rythme « idéal » de consommation du budget */
  elapsed: number
  /** dépenses du quotidien d'aujourd'hui */
  spentToday: number
  /** enveloppe du jour, calculée sur ce qu'il restait ce matin */
  dayBudget: number
}

const sum = (txs: Transaction[]) => txs.reduce((s, t) => s + t.amount, 0)

/** Rythme quotidien moyen des dépenses du quotidien sur les mois complets précédents. */
export function historicalDailyRate(transactions: Transaction[], today: Date, isFixed: (t: Transaction) => boolean = (t) => !!t.recurringId, months = 3): number | null {
  const current = monthKey(today)
  let total = 0
  let days = 0
  for (let i = 1; i <= months; i++) {
    const m = addMonths(current, -i)
    const txs = transactions.filter((t) => t.type === 'expense' && !isFixed(t) && monthOf(t.date) === m)
    if (txs.length === 0) continue
    total += sum(txs)
    days += daysInMonth(m)
  }
  return days > 0 ? total / days : null
}

export function forecastMonth(
  transactions: Transaction[],
  recurring: Recurring[],
  budget: number,
  today = new Date(),
  hints: ForecastHints = {},
): Forecast {
  const month = monthKey(today)
  const day = today.getDate()
  const dim = daysInMonth(month)
  const daysLeft = dim - day + 1
  const isFixed = fixedMatcher(recurring)

  const inMonth = transactions.filter((t) => monthOf(t.date) === month)
  const expenses = inMonth.filter((t) => t.type === 'expense')
  const fixed = expenses.filter(isFixed)
  const daily = expenses.filter((t) => !isFixed(t))
  const spent = sum(daily)
  const fixedPaid = sum(fixed)
  const income = sum(inMonth.filter((t) => t.type === 'income'))

  // charges fixes déclarées pas encore passées ce mois-ci (pour information, hors budget)
  const paidIds = new Set(fixed.map((t) => t.recurringId).filter(Boolean))
  const paidLabels = new Set(fixed.map((t) => normalize(t.label)))
  const fixedUpcoming = recurring
    .filter((r) => r.active && r.type === 'expense' && !paidIds.has(r.id) && !paidLabels.has(normalize(r.label)) && (r.lastGenerated ?? '') < month)
    .reduce((s, r) => s + r.amount, 0)

  // Dépenses récurrentes détectées mais pas encore déclarées : elles restent dans le budget,
  // mais on ne les extrapole pas — on ajoute plutôt celles qui ne sont pas encore passées.
  const detected = hints.detected ?? []
  const detectedKeys = new Set(detected.map((d) => d.key))
  const seenKeys = new Set(daily.map((t) => normalize(t.label)))
  const upcomingDetected = detected.filter((d) => !seenKeys.has(d.key) && Math.min(d.dayOfMonth, dim) > day).reduce((s, d) => s + d.amount, 0)

  // Rythme : sans les récurrentes détectées ni les grosses dépenses ponctuelles (> 15 % du budget).
  const oneOff = budget > 0 ? budget * 0.15 : Infinity
  const variable = sum(daily.filter((t) => !detectedKeys.has(normalize(t.label)) && t.amount <= oneOff))
  const currentRate = variable / day
  const hist = historicalDailyRate(transactions, today, isFixed)
  const w = hist === null ? 1 : Math.min(day / 10, 1) // le mois est jeune → on s'appuie sur l'historique
  const rate = w * currentRate + (1 - w) * (hist ?? 0)

  const projected = spent + rate * (daysLeft - 1) + upcomingDetected
  const remaining = budget - spent
  const perDay = Math.max(0, (budget - spent - upcomingDetected) / daysLeft)
  const todayKey = toKey(today)
  const spentToday = sum(daily.filter((t) => t.date === todayKey))
  const dayBudget = budget > 0 ? Math.max(0, (budget - (spent - spentToday) - upcomingDetected) / daysLeft) : 0

  let status: BudgetStatus = 'ok'
  if (budget <= 0) status = 'none'
  else if (spent > budget) status = 'exceeded'
  else if (projected > budget) status = 'over'
  else if (projected > budget * 0.9) status = 'warning'

  return { spent, fixedPaid, fixedUpcoming, income, budget, remaining, perDay, projected, daysLeft, status, progress: budget > 0 ? spent / budget : 0, elapsed: day / dim, spentToday, dayBudget }
}
