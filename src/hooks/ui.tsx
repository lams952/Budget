import { createContext, useContext, useEffect, useState } from 'react'
import type { ConfirmData, ToastData } from '../components/ui'
import type { Transaction } from '../lib/types'

export type Tab = 'home' | 'history' | 'insights' | 'settings'

export interface UI {
  tab: Tab
  setTab: (t: Tab) => void
  openQuickAdd: () => void
  editTransaction: (t: Transaction) => void
  /** recherche de l'historique (partagée pour pouvoir y arriver depuis un autre écran) */
  search: string
  setSearch: (q: string) => void
  /** ouvre l'historique filtré sur `query` */
  openHistory: (query?: string) => void
  toast: (message: string, action?: ToastData['action']) => void
  confirm: (data: ConfirmData) => void
}

export const UIContext = createContext<UI | null>(null)
export const useUI = () => useContext(UIContext)!

export function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])
  return online
}
