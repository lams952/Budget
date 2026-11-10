const eur = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })
const eur0 = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })

export const money = (n: number) => eur.format(n)
/** Arrondi à l'euro si le montant est "gros" */
export const moneyShort = (n: number) => (Math.abs(n) >= 100 || Number.isInteger(n) ? eur0.format(n) : eur.format(n))
export const pct = (n: number) => `${Math.round(n * 100)} %`

const dayFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
const monthFmt = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' })

export const capitalize = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s)
export const longDay = (d: Date) => capitalize(dayFmt.format(d))
export const monthName = (d: Date) => capitalize(monthFmt.format(d))
