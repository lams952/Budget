import { createContext, useContext, useSyncExternalStore, type ReactNode } from 'react'
import type { Store } from '../data/store'

const StoreContext = createContext<Store | null>(null)

export function StoreProvider({ store, children }: { store: Store; children: ReactNode }) {
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
}

export function useStore(): Store {
  const s = useContext(StoreContext)
  if (!s) throw new Error('StoreProvider manquant')
  return s
}

export function useData() {
  const store = useStore()
  return useSyncExternalStore(store.subscribe, store.getState)
}
