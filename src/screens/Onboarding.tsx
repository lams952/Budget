import { useState } from 'react'
import { PrimaryButton, parseAmount, useVisualViewport } from '../components/ui'
import { useStore } from '../hooks/data'

const PRESETS = [600, 900, 1200, 1500, 2000]
const TIPS = [
  ['⚡️', 'Saisie éclair', 'Tape « 12,50 boulangerie hier », c\'est tout.'],
  ['🧠', 'Catégories devinées', "L'app apprend de tes habitudes et de tes corrections."],
  ['🔮', 'Fin de mois prévue', 'Tu sais chaque jour combien tu peux encore dépenser.'],
] as const

export function Onboarding() {
  // occupe la zone visible au-dessus du clavier pour que le bouton reste accessible
  const vv = useVisualViewport()
  const store = useStore()
  const [budget, setBudget] = useState('')
  const value = Math.round(parseAmount(budget))

  return (
    <div style={{ top: vv.top, height: vv.height }} className={`scroller pt-safe fixed inset-x-0 mx-auto flex max-w-md flex-col ${vv.keyboard ? 'pb-3' : 'pb-safe'} px-6`}>
      <div className="fade-up flex flex-1 flex-col justify-center py-6">
        <p className="text-[13px] font-semibold tracking-wide text-accent uppercase">Bienvenue</p>
        <h1 className={`display mt-1 ${vv.keyboard ? 'text-[26px]' : 'text-[32px]'} leading-tight font-bold`}>
          Combien veux-tu
          <br />
          dépenser par mois ?
        </h1>
        <p className="mt-3 text-[16px] text-muted">Pour le quotidien : courses, sorties, shopping… Le loyer et les abonnements sont suivis à part.</p>
        <label className={`${vv.keyboard ? 'mt-5' : 'mt-8'} card flex items-baseline rounded-3xl px-5 py-3 focus-within:ring-2 focus-within:ring-accent/50`}>
          <input
            autoFocus
            inputMode="numeric"
            placeholder="1200"
            aria-label="Budget mensuel en euros"
            value={budget}
            onChange={(e) => setBudget(e.target.value.replace(/[^\d\s]/g, ''))}
            className="num min-w-0 flex-1 bg-transparent text-[44px] font-bold outline-none placeholder:text-card2"
          />
          <span className="text-[18px] font-medium text-muted">€ / mois</span>
        </label>
        <div className="no-scrollbar -mx-6 mt-3 flex gap-2 overflow-x-auto px-6">
          {PRESETS.map((p) => (
            <button
              key={p}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setBudget(String(p))}
              className={`press num shrink-0 rounded-full px-3.5 py-2 text-[14px] font-semibold ${value === p ? 'bg-accent text-white' : 'card'}`}
            >
              {p.toLocaleString('fr-FR')} €
            </button>
          ))}
        </div>
        {!vv.keyboard && (
          <ul className="mt-8 space-y-4">
            {TIPS.map(([emoji, title, text]) => (
              <li key={title} className="flex items-center gap-3.5">
                <span className="card flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-[20px]">{emoji}</span>
                <span className="text-[15px]">
                  <b className="font-semibold">{title}</b>
                  <br />
                  <span className="text-muted">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="pb-4">
        <PrimaryButton disabled={!(value > 0)} onClick={() => store.saveSettings({ monthlyBudget: value, onboarded: true })}>
          Commencer
        </PrimaryButton>
        <button onClick={() => store.saveSettings({ onboarded: true })} className="press mt-2 w-full py-2.5 text-[15px] text-muted">
          Je déciderai plus tard
        </button>
      </div>
    </div>
  )
}
