import { addDays, fromKey, toKey } from './dates'

const short = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })

export function dateLabel(key: string, today = new Date()): string {
  if (key === toKey(today)) return "Aujourd'hui"
  if (key === toKey(addDays(today, -1))) return 'Hier'
  const s = short.format(fromKey(key))
  return s[0].toUpperCase() + s.slice(1)
}
