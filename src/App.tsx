import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { EditTransactionSheet } from './components/EditTransactionSheet'
import { QuickAddSheet } from './components/QuickAddSheet'
import { TabBar } from './components/TabBar'
import { Toast } from './components/ui'
import { SupabaseStore } from './data/supabaseStore'
import { LocalStore } from './data/localStore'
import type { Store } from './data/store'
import { getSupabase, supabaseEnabled } from './supabase'
import { StoreProvider, useData, useStore } from './hooks/data'
import { UIContext, type Tab, type UI } from './hooks/ui'
import { useAuth } from './hooks/useAuth'
import { toKey } from './lib/dates'
import { dueRecurring } from './lib/smart/recurring'
import type { Transaction } from './lib/types'
import { History } from './screens/History'
import { Home } from './screens/Home'
import { Insights } from './screens/Insights'
import { Login } from './screens/Login'
import { Onboarding } from './screens/Onboarding'
import { Settings } from './screens/Settings'

export default function App() {
  const user = useAuth()
  if (!supabaseEnabled) return <WithStore id="local" make={() => new LocalStore()} />
  if (user === undefined) return <Splash />
  if (!user) return <Login />
  return <WithStore id={user.id} make={() => new SupabaseStore(getSupabase(), user.id)} email={user.email} />
}

function WithStore({ id, make, email }: { id: string; make: () => Store; email?: string | null }) {
  const [store, setStore] = useState<Store | null>(null)
  const makeRef = useRef(make)
  useEffect(() => {
    const s = makeRef.current()
    setStore(s)
    return () => s.dispose()
  }, [id])
  if (!store) return <Splash />
  return (
    <StoreProvider store={store}>
      <Shell email={email} />
    </StoreProvider>
  )
}

function Splash() {
  return <div className="flex h-full items-center justify-center text-muted">…</div>
}

/** Change quand on revient sur l'app un autre jour (pour les prévisions et les récurrentes). */
function useToday() {
  const [day, setDay] = useState(() => toKey(new Date()))
  useEffect(() => {
    const check = () => document.visibilityState === 'visible' && setDay(toKey(new Date()))
    document.addEventListener('visibilitychange', check)
    return () => document.removeEventListener('visibilitychange', check)
  }, [])
  return day
}

function Shell({ email }: { email?: string | null }) {
  const store = useStore()
  const data = useData()
  const day = useToday()
  const [tab, setTabState] = useState<Tab>('home')
  const [quickOpen, setQuickOpen] = useState(false)
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const showToast = useCallback((m: string) => {
    setToast(m)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 1800)
  }, [])

  // Génère automatiquement les charges fixes arrivées à échéance.
  useEffect(() => {
    if (!data.ready) return
    const { toCreate, updates } = dueRecurring(data.recurring, data.transactions)
    if (toCreate.length) store.addTransactions(toCreate)
    for (const u of updates) {
      const r = data.recurring.find((x) => x.id === u.id)
      if (r && r.lastGenerated !== u.lastGenerated) store.updateRecurring(u.id, { lastGenerated: u.lastGenerated })
    }
  }, [data.ready, data.recurring, day])

  const setTab = useCallback((t: Tab) => {
    setTabState(t)
    window.scrollTo({ top: 0 })
  }, [])
  const openQuickAdd = useCallback(() => {
    setQuickOpen(true)
    // focus synchrone dans le geste utilisateur : nécessaire pour ouvrir le clavier sur iOS
    inputRef.current?.focus({ preventScroll: true })
  }, [])
  const ui: UI = useMemo(() => ({ tab, setTab, openQuickAdd, editTransaction: setEditing }), [tab, setTab, openQuickAdd])

  if (!data.ready) return <Splash />
  if (!data.settings.onboarded && data.transactions.length === 0) return <Onboarding />

  return (
    <UIContext.Provider value={ui}>
      <main key={day} className="pt-safe mx-auto max-w-lg px-5 pb-32">
        {tab === 'home' && <Home />}
        {tab === 'history' && <History onToast={showToast} />}
        {tab === 'insights' && <Insights />}
        {tab === 'settings' && <Settings email={email} onToast={showToast} />}
      </main>
      <TabBar tab={tab} setTab={setTab} onAdd={openQuickAdd} />
      <QuickAddSheet ref={inputRef} open={quickOpen} onClose={() => setQuickOpen(false)} onSaved={showToast} />
      <EditTransactionSheet tx={editing} onClose={() => setEditing(null)} onDone={showToast} />
      <Toast message={toast} />
    </UIContext.Provider>
  )
}
