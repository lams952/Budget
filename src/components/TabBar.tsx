import type { Tab } from '../hooks/ui'

const ICONS: Record<Tab, string> = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  history: 'M4 6h16M4 12h16M4 18h10',
  insights: 'M12 3v9l7.8 4.5M21 12a9 9 0 1 1-9-9',
  settings: 'M4 7h10M18 7h2M4 17h4M12 17h8M16 5v4M10 15v4',
}
const LABELS: Record<Tab, string> = { home: 'Accueil', history: 'Historique', insights: 'Analyse', settings: 'Réglages' }

export function TabBar({ tab, setTab, onAdd }: { tab: Tab; setTab: (t: Tab) => void; onAdd: () => void }) {
  const item = (t: Tab) => {
    const active = tab === t
    return (
      <button
        key={t}
        onClick={() => setTab(t)}
        className={`press flex flex-1 flex-col items-center gap-[3px] pt-2.5 text-[10px] font-semibold transition-colors ${active ? 'text-accent' : 'text-muted'}`}
        aria-current={active ? 'page' : undefined}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.3 : 1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d={ICONS[t]} />
        </svg>
        {LABELS[t]}
      </button>
    )
  }
  return (
    <nav className="pb-safe relative z-30 shrink-0 border-t border-line bg-card/85 backdrop-blur-2xl">
      <div className="mx-auto flex max-w-lg items-start">
        {item('home')}
        {item('history')}
        <div className="flex flex-1 justify-center">
          <button onClick={onAdd} aria-label="Ajouter une dépense" className="press accent-grad fab -mt-6 flex h-[58px] w-[58px] items-center justify-center rounded-full">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden>
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
