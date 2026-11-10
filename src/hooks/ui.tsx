import { createContext, useContext } from 'react'
import type { Transaction } from '../lib/types'

export type Tab = 'home' | 'history' | 'insights' | 'settings'

export interface UI {
  tab: Tab
  setTab: (t: Tab) => void
  openQuickAdd: () => void
  editTransaction: (t: Transaction) => void
}

export const UIContext = createContext<UI | null>(null)
export const useUI = () => useContext(UIContext)!
