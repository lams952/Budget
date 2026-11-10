import type { TxType } from './types'

export interface Category {
  id: string
  label: string
  emoji: string
  color: string
  type: TxType
}

export const CATEGORIES: Category[] = [
  { id: 'courses', label: 'Courses', emoji: '🛒', color: '#34C759', type: 'expense' },
  { id: 'resto', label: 'Restos & cafés', emoji: '🍽️', color: '#FF9500', type: 'expense' },
  { id: 'transport', label: 'Transport', emoji: '🚗', color: '#007AFF', type: 'expense' },
  { id: 'logement', label: 'Logement & factures', emoji: '🏠', color: '#5856D6', type: 'expense' },
  { id: 'abonnements', label: 'Abonnements', emoji: '📱', color: '#AF52DE', type: 'expense' },
  { id: 'loisirs', label: 'Loisirs & sorties', emoji: '🎉', color: '#FF2D55', type: 'expense' },
  { id: 'shopping', label: 'Shopping', emoji: '🛍️', color: '#FF6482', type: 'expense' },
  { id: 'sante', label: 'Santé', emoji: '💊', color: '#30B0C7', type: 'expense' },
  { id: 'voyage', label: 'Voyages', emoji: '✈️', color: '#00C7BE', type: 'expense' },
  { id: 'autre', label: 'Autre', emoji: '•', color: '#8E8E93', type: 'expense' },
  { id: 'salaire', label: 'Salaire', emoji: '💼', color: '#34C759', type: 'income' },
  { id: 'revenu', label: 'Autre revenu', emoji: '💶', color: '#30D158', type: 'income' },
]

const byId = new Map(CATEGORIES.map((c) => [c.id, c]))
export const getCategory = (id: string): Category => byId.get(id) ?? byId.get('autre')!
export const categoriesFor = (type: TxType) => CATEGORIES.filter((c) => c.type === type)
