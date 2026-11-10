import { getCategory } from '../categories'
import { addMonths, fromKey, monthKey, monthOf } from '../dates'
import { moneyShort } from '../format'
import type { Transaction } from '../types'
import { normalize } from './normalize'

export interface Insight {
  id: string
  tone: 'good' | 'warn' | 'info'
  icon: string
  title: string
  text: string
}

export interface CategoryTotal {
  category: string
  total: number
  count: number
}

export function totalsByCategory(transactions: Transaction[], month: string, type: 'expense' | 'income' = 'expense'): CategoryTotal[] {
  const map = new Map<string, CategoryTotal>()
  for (const t of transactions) {
    if (t.type !== type || monthOf(t.date) !== month) continue
    const c = map.get(t.category) ?? { category: t.category, total: 0, count: 0 }
    c.total += t.amount
    c.count++
    map.set(t.category, c)
  }
  return [...map.values()].sort((a, b) => b.total - a.total)
}

const WEEKDAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']

/**
 * Conseils pour le mois `month`. Si c'est le mois en cours, les comparaisons
 * se font « à la même date » du mois précédent pour rester justes.
 */
export function generateInsights(transactions: Transaction[], month: string, today = new Date(), fixedLabels: string[] = []): Insight[] {
  const fixed = new Set(fixedLabels.map(normalize))
  const out: Insight[] = []
  const isCurrent = month === monthKey(today)
  const cutoffDay = isCurrent ? today.getDate() : 31
  const prev = addMonths(month, -1)
  const exp = transactions.filter((t) => t.type === 'expense')
  const upTo = (m: string) => exp.filter((t) => monthOf(t.date) === m && Number(t.date.slice(8)) <= cutoffDay)
  const sum = (ts: Transaction[]) => ts.reduce((s, t) => s + t.amount, 0)

  const cur = upTo(month)
  const before = upTo(prev)
  const curTotal = sum(cur)
  const prevTotal = sum(before)

  // 1. tendance globale
  if (prevTotal > 0 && curTotal > 0) {
    const diff = (curTotal - prevTotal) / prevTotal
    const when = isCurrent ? ' à la même date' : ''
    if (diff <= -0.05)
      out.push({ id: 'trend', tone: 'good', icon: '📉', title: `${Math.round(-diff * 100)} % de dépenses en moins`, text: `Par rapport au mois dernier${when} : ${moneyShort(curTotal)} contre ${moneyShort(prevTotal)}.` })
    else if (diff >= 0.1)
      out.push({ id: 'trend', tone: 'warn', icon: '📈', title: `${Math.round(diff * 100)} % de dépenses en plus`, text: `Par rapport au mois dernier${when} : ${moneyShort(curTotal)} contre ${moneyShort(prevTotal)}.` })
  }

  // 2. catégories qui s'envolent / baissent
  const byCat = (ts: Transaction[]) => {
    const m = new Map<string, number>()
    for (const t of ts) m.set(t.category, (m.get(t.category) ?? 0) + t.amount)
    return m
  }
  const c1 = byCat(cur)
  const c0 = byCat(before)
  const changes = [...new Set([...c1.keys(), ...c0.keys()])]
    .map((cat) => ({ cat, now: c1.get(cat) ?? 0, was: c0.get(cat) ?? 0 }))
    .map((x) => ({ ...x, diff: x.now - x.was }))
  const up = changes.filter((x) => x.diff >= 20 && x.now > x.was * 1.3).sort((a, b) => b.diff - a.diff)[0]
  if (up) {
    const c = getCategory(up.cat)
    out.push({ id: `cat-up-${up.cat}`, tone: 'warn', icon: c.emoji, title: `${c.label} : +${moneyShort(up.diff)}`, text: `${moneyShort(up.now)} ce mois-ci contre ${moneyShort(up.was)} le mois dernier. C'est le poste à surveiller.` })
  }
  const down = changes.filter((x) => x.diff <= -20 && x.now < x.was * 0.7).sort((a, b) => a.diff - b.diff)[0]
  if (down) {
    const c = getCategory(down.cat)
    out.push({ id: `cat-down-${down.cat}`, tone: 'good', icon: c.emoji, title: `${c.label} : ${moneyShort(down.diff)}`, text: `Bien joué, tu as réduit ce poste par rapport au mois dernier.` })
  }

  // 3. petites dépenses qui s'accumulent
  const small = cur.filter((t) => t.amount < 10)
  const smallTotal = sum(small)
  if (small.length >= 8 && smallTotal >= 40)
    out.push({ id: 'small', tone: 'info', icon: '☕️', title: `${small.length} petites dépenses = ${moneyShort(smallTotal)}`, text: `Les achats de moins de 10 € pèsent ${Math.round((smallTotal / curTotal) * 100)} % de tes dépenses du mois.` })

  // 4. plus grosse dépense
  const biggest = cur.filter((t) => !t.recurringId && !fixed.has(normalize(t.label))).reduce<Transaction | null>((a, b) => (!a || b.amount > a.amount ? b : a), null)
  if (biggest && curTotal > 0 && biggest.amount / curTotal >= 0.15 && !biggest.recurringId && !fixed.has(normalize(biggest.label)))
    out.push({ id: 'biggest', tone: 'info', icon: '🔎', title: `Plus grosse dépense : ${moneyShort(biggest.amount)}`, text: `${biggest.label || getCategory(biggest.category).label}, soit ${Math.round((biggest.amount / curTotal) * 100)} % du mois.` })

  // 5. jour de la semaine le plus dépensier (90 derniers jours, hors récurrentes)
  const since = addMonths(month, -3)
  const recent = exp.filter((t) => !t.recurringId && monthOf(t.date) >= since && monthOf(t.date) <= month)
  if (recent.length >= 15) {
    const perDay = Array(7).fill(0)
    for (const t of recent) perDay[fromKey(t.date).getDay()] += t.amount
    const avg = perDay.reduce((a, b) => a + b, 0) / 7
    const max = Math.max(...perDay)
    const idx = perDay.indexOf(max)
    if (max > avg * 1.5)
      out.push({ id: 'weekday', tone: 'info', icon: '📅', title: `Le ${WEEKDAYS[idx]}, tu dépenses plus`, text: `${Math.round((max / avg - 1) * 100)} % au-dessus d'un jour moyen ces 3 derniers mois.` })
  }

  // 6. épargne du mois précédent (mois complet)
  const all = transactions.filter((t) => monthOf(t.date) === prev)
  const inc = all.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const out0 = all.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  if (inc > 0) {
    const saved = inc - out0
    out.push(
      saved >= 0
        ? { id: 'saved', tone: 'good', icon: '🐷', title: `${moneyShort(saved)} mis de côté le mois dernier`, text: `Soit ${Math.round((saved / inc) * 100)} % de tes revenus.` }
        : { id: 'saved', tone: 'warn', icon: '⚠️', title: `${moneyShort(-saved)} de plus que tes revenus`, text: `Le mois dernier, tes dépenses ont dépassé tes revenus.` },
    )
  }

  return out
}
