import type { Tab } from '../hooks/ui'

const ICONS: Record<Tab, string> = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  history: 'M4 6h16M4 12h16M4 18h10',
  insights: 'M12 3v9l7.8 4.5M21 12a9 9 0 1 1-9-9',
  settings: 'M4 7h10M18 7h2M4 17h4M12 17h8M16 5v4M10 15v4',
}
const LABELS: Record<Tab, string> = { home: 'Accueil', history: 'Historique', insights: 'Analyse', settings: 'Réglages' }

export function TabBar({ tab, setTab, onAdd }: { tab: Tab; setTab: (t: Tab) => void; onAdd: () => void }) {
  const item = (t: Tab) => (
    <button key={t} onClick={() => setTab(t)} className={`flex flex-1 flex-col items-center gap-0.5 pt-2 text-[10px] font-medium transition-colors ${tab === t ? 'text-ink' : 'text-muted'}`}>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={tab === t ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d={ICONS[t]} />
      </svg>
      {LABELS[t]}
    </button>
  )
  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-lg items-start">
        {item('home')}
        {item('history')}
        <div className="flex flex-1 justify-center">
          <button onClick={onAdd} aria-label="Ajouter une dépense" className="press -mt-5 flex h-14 w-14 items-center justify-center rounded-full bg-ink text-bg shadow-lg">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>
        {item('insights')}
        {item('settings')}
      </div>
    </nav>
  )
}
