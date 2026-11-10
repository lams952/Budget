import { daysInMonth, monthKey, monthOf, addMonths } from '../dates'
import type { Recurring, Transaction } from '../types'
import { normalize } from './normalize'

export interface ForecastHints {
  /** dépenses récurrentes détectées automatiquement (pas encore déclarées en charges fixes) */
  detected?: { key: string; amount: number; dayOfMonth: number }[]
}

export type BudgetStatus = 'ok' | 'warning' | 'over' | 'exceeded' | 'none'

export interface Forecast {
  spent: number
  income: number
  budget: number
  remaining: number
  /** ce qu'on peut dépenser par jour (aujourd'hui inclus) en tenant compte des charges à venir */
  perDay: number
  projected: number
  upcomingRecurring: number
  daysLeft: number // aujourd'hui inclus
  status: BudgetStatus
  progress: number // spent / budget
}

const sum = (txs: Transaction[]) => txs.reduce((s, t) => s + t.amount, 0)

/** Rythme quotidien moyen des dépenses variables (hors récurrentes) sur les mois complets précédents. */
export function historicalDailyRate(transactions: Transaction[], today: Date, months = 3): number | null {
  const current = monthKey(today)
  let total = 0
  let days = 0
  for (let i = 1; i <= months; i++) {
    const m = addMonths(current, -i)
    const txs = transactions.filter((t) => t.type === 'expense' && !t.recurringId && monthOf(t.date) === m)
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

  const inMonth = transactions.filter((t) => monthOf(t.date) === month)
  const expenses = inMonth.filter((t) => t.type === 'expense')
  const spent = sum(expenses)
  const income = sum(inMonth.filter((t) => t.type === 'income'))
  // Dépenses « variables » : on exclut les charges fixes, celles détectées comme récurrentes
  // et les grosses dépenses ponctuelles (> 15 % du budget), qu'on ne doit pas extrapoler.
  const detectedKeys = new Set((hints.detected ?? []).map((d) => d.key))
  const oneOff = budget > 0 ? budget * 0.15 : Infinity
  const variable = sum(expenses.filter((t) => !t.recurringId && !detectedKeys.has(normalize(t.label)) && t.amount <= oneOff))

  // charges récurrentes pas encore passées ce mois-ci
  const generated = new Set(expenses.filter((t) => t.recurringId).map((t) => t.recurringId))
  const upcomingDeclared = recurring
    .filter((r) => r.active && r.type === 'expense' && !generated.has(r.id) && (r.lastGenerated ?? '') < month)
    .filter((r) => Math.min(r.dayOfMonth, dim) > day)
    .reduce((s, r) => s + r.amount, 0)
  // + les récurrentes détectées qui ne sont pas encore passées ce mois-ci
  const seenKeys = new Set(expenses.map((t) => normalize(t.label)))
  const upcomingDetected = (hints.detected ?? [])
    .filter((d) => !seenKeys.has(d.key) && Math.min(d.dayOfMonth, dim) > day)
    .reduce((s, d) => s + d.amount, 0)
  const upcomingRecurring = upcomingDeclared + upcomingDetected

  // rythme : on mélange le mois en cours et l'historique tant que le mois est jeune
  const currentRate = variable / day
  const hist = historicalDailyRate(transactions, today)
  const w = hist === null ? 1 : Math.min(day / 10, 1)
  const rate = w * currentRate + (1 - w) * (hist ?? 0)

  const projected = spent + rate * (daysLeft - 1) + upcomingRecurring
  const remaining = budget - spent
  const perDay = Math.max(0, (budget - spent - upcomingRecurring) / daysLeft)

  let status: BudgetStatus = 'ok'
  if (budget <= 0) status = 'none'
  else if (spent > budget) status = 'exceeded'
  else if (projected > budget) status = 'over'
  else if (projected > budget * 0.9) status = 'warning'

  return {
    spent,
    income,
    budget,
    remaining,
    perDay,
    projected,
    upcomingRecurring,
    daysLeft,
    status,
    progress: budget > 0 ? spent / budget : 0,
  }
}
