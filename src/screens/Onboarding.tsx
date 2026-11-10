import { useState } from 'react'
import { PrimaryButton } from '../components/ui'
import { useStore } from '../hooks/data'

export function Onboarding() {
  const store = useStore()
  const [budget, setBudget] = useState('')
  const value = Math.round(Number(budget.replace(/\s/g, '').replace(',', '.')))

  return (
    <div className="pt-safe pb-safe mx-auto flex min-h-full max-w-md flex-col px-6">
      <div className="fade-up flex flex-1 flex-col justify-center">
        <h1 className="text-[34px] leading-tight font-bold tracking-tight">
          Combien veux-tu
          <br />
          dépenser par mois ?
        </h1>
        <p className="mt-3 text-[17px] text-muted">Charges fixes comprises. Tu pourras le changer quand tu veux.</p>
        <div className="mt-10 flex items-baseline border-b-2 border-ink pb-2">
          <input
            autoFocus
            inputMode="numeric"
            placeholder="1500"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            className="tabular min-w-0 flex-1 bg-transparent text-[48px] font-semibold tracking-tight outline-none placeholder:text-card2"
          />
          <span className="text-[28px] text-muted">€</span>
        </div>
        <ul className="mt-10 space-y-4 text-[15px]">
          <li className="flex gap-3">
            <span>⚡️</span>
            <span>
              Ajoute une dépense en tapant simplement <b>« 12,50 boulangerie »</b>.
            </span>
          </li>
          <li className="flex gap-3">
            <span>🧠</span>
            <span>L'app devine la catégorie et apprend de tes corrections.</span>
          </li>
          <li className="flex gap-3">
            <span>🔮</span>
            <span>Elle prévoit ta fin de mois et te dit combien tu peux dépenser par jour.</span>
          </li>
        </ul>
      </div>
      <div className="pb-6">
        <PrimaryButton disabled={!(value > 0)} onClick={() => store.saveSettings({ monthlyBudget: value, onboarded: true })}>
          Commencer
        </PrimaryButton>
        <button onClick={() => store.saveSettings({ onboarded: true })} className="mt-3 w-full py-2 text-[15px] text-muted">
          Plus tard
        </button>
      </div>
    </div>
  )
}
