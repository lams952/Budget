import { addDays, toKey } from '../dates'
import type { TxType } from '../types'
import { normalize } from './normalize'

export interface ParsedInput {
  amount: number | null
  type: TxType
  label: string
  date: string // YYYY-MM-DD
}

const WEEKDAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']
const INCOME_WORDS = /\b(salaire|paie|paye|prime|remboursement|rembourse|virement recu|vente|cadeau recu|allocation|caf|bonus)\b/

/** Analyse une saisie libre du type « 12,50 boulangerie hier » ou « +1800 salaire ». */
export function parseQuickInput(raw: string, today = new Date()): ParsedInput {
  let text = ` ${raw.trim()} `
  let date = today

  // --- dates ---------------------------------------------------------------
  const take = (re: RegExp, fn: (m: RegExpMatchArray) => Date | null) => {
    const m = text.match(re)
    if (!m) return
    const d = fn(m)
    if (d) {
      date = d
      text = text.replace(m[0], ' ')
    }
  }
  take(/\s(avant[- ]hier)\s/i, () => addDays(today, -2))
  take(/\s(hier)\s/i, () => addDays(today, -1))
  take(/\s(aujourd'?hui|auj)\s/i, () => today)
  take(/\sil y a (\d{1,2}) jours?\s/i, (m) => addDays(today, -Number(m[1])))
  take(/\s(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\s/, (m) => {
    const day = Number(m[1])
    const month = Number(m[2]) - 1
    if (day < 1 || day > 31 || month < 0 || month > 11) return null
    let year = m[3] ? Number(m[3]) : today.getFullYear()
    if (year < 100) year += 2000
    const d = new Date(year, month, day)
    // sans année et dans le futur → l'année dernière
    if (!m[3] && d > today) d.setFullYear(year - 1)
    return d
  })
  take(/\s(?:le )(\d{1,2})(?:er)?\s/i, (m) => {
    const day = Number(m[1])
    if (day < 1 || day > 31) return null
    const d = new Date(today.getFullYear(), today.getMonth(), day)
    if (d > today) d.setMonth(d.getMonth() - 1)
    return d
  })
  const wd = new RegExp(`\\s(${WEEKDAYS.join('|')})( dernier)?\\s`, 'i')
  take(wd, (m) => {
    const target = WEEKDAYS.indexOf(m[1].toLowerCase())
    let diff = (today.getDay() - target + 7) % 7
    if (diff === 0) diff = 7
    return addDays(today, -diff)
  })

  // --- montant ------------------------------------------------------------
  let amount: number | null = null
  let type: TxType = 'expense'
  const amountRe = /(^|\s)([+-])?\s?(\d{1,3}(?:[  ]\d{3})+|\d+)(?:[.,](\d{1,2}))?(?!\d)\s?(€|eur(?:os?)?\b)?/i
  // préfère un nombre suivi de €
  const withEuro = new RegExp(amountRe.source.replace(/\)\?$/, ')'), 'i')
  const m = text.match(withEuro) ?? text.match(amountRe)
  if (m) {
    const int = m[3].replace(/[  ]/g, '')
    amount = Number(`${int}.${m[4] ?? '0'}`)
    if (m[2] === '+') type = 'income'
    text = text.replace(m[0], ' ')
  }

  let label = text
    .replace(/\s(de|du|pour|chez|à|a|au)\s*$/i, ' ')
    .replace(/^\s*(de|du|pour|à|au)\s/i, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (type === 'expense' && INCOME_WORDS.test(normalize(label))) type = 'income'
  label = label ? label[0].toUpperCase() + label.slice(1) : ''

  return { amount, type, label, date: toKey(date) }
}
