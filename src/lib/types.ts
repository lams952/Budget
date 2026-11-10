export type TxType = 'expense' | 'income'

export interface Transaction {
  id: string
  amount: number // toujours positif
  type: TxType
  category: string
  label: string
  date: string // YYYY-MM-DD (heure locale)
  recurringId?: string
  createdAt: number
}

export interface Recurring {
  id: string
  label: string
  amount: number
  type: TxType
  category: string
  dayOfMonth: number // 1..31
  active: boolean
  startMonth: string // YYYY-MM
  lastGenerated?: string // YYYY-MM
}

export interface Settings {
  monthlyBudget: number
  currency: string
  dismissedSuggestions: string[]
  onboarded: boolean
}

/** libellé normalisé -> catégorie choisie par l'utilisateur */
export type Learned = Record<string, string>

export const DEFAULT_SETTINGS: Settings = {
  monthlyBudget: 0,
  currency: 'EUR',
  dismissedSuggestions: [],
  onboarded: false,
}
