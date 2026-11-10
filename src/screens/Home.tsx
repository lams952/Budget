import { useMemo } from 'react'
import { TransactionRow } from '../components/TransactionRow'
import { Amount, Card, CategoryIcon, EmptyState, Icon, SectionTitle } from '../components/ui'
import { useData, useStore } from '../hooks/data'
import { useOnline, useUI } from '../hooks/ui'
import { getCategory } from '../lib/categories'
import { monthKey, monthOf } from '../lib/dates'
import { dateLabel } from '../lib/dateLabel'
import { money, moneyRound, moneyShort, monthName } from '../lib/format'
import { upcomingThisMonth } from '../lib/smart/fixed'
import { forecastMonth, type BudgetStatus, type Forecast } from '../lib/smart/forecast'
import { generateInsights } from '../lib/smart/insights'
import { normalize } from '../lib/smart/normalize'
import { detectRecurring } from '../lib/smart/recurring'

// bandeau irisé : teinte pastel selon l'état du budget
const BAND: Record<BudgetStatus, string> = { ok: 'var(--iri)', warning: 'var(--iri-warn)', over: 'var(--iri-warn)', exceeded: 'var(--iri-bad)', none: 'var(--iri)' }

function statusText(f: Forecast): string {
  switch (f.status) {
    case 'ok':
      return `Dans les clous · environ ${moneyRound(Math.max(f.budget - f.projected, 0))} de marge`
    case 'warning':
      return `Ça va être juste · environ ${moneyRound(Math.max(f.budget - f.projected, 0))} de marge`
    case 'over':
      return `À ce rythme, dépassement d'environ ${moneyRound(f.projected - f.budget)}`
    case 'exceeded':
      return `Budget dépassé de ${moneyRound(-f.remaining)}`
    case 'none':
      return ''
  }
}

export function Home() {
  const { transactions, recurring, settings, pending } = useData()
  const store = useStore()
  const online = useOnline()
  const { setTab, editTransaction, openQuickAdd, openHistory, toast } = useUI()
  const today = new Date()
  const month = monthKey(today)
  const detected = useMemo(() => detectRecurring(transactions, recurring, settings.dismissedSuggestions), [transactions, recurring, settings.dismissedSuggestions])
  const f = useMemo(() => forecastMonth(transactions, recurring, settings.monthlyBudget, new Date(), { detected }), [transactions, recurring, settings.monthlyBudget, detected])
  const upcoming = useMemo(() => upcomingThisMonth(recurring, transactions), [recurring, transactions])
  const suggestion = detected[0]
  const insight = useMemo(() => generateInsights(transactions, monthKey(new Date()), new Date(), recurring.map((r) => r.label))[0], [transactions, recurring])
  const recent = transactions.slice(0, 5)
  const hasBudget = f.status !== 'none'
  const todayLeft = f.dayBudget - f.spentToday
  const balance = f.income - f.spent - f.fixedPaid

  const addSuggestion = () => {
    // si elle a déjà été saisie à la main ce mois-ci, la première échéance automatique sera le mois prochain
    const seen = transactions.some((t) => monthOf(t.date) === month && normalize(t.label) === suggestion.key)
    store.addRecurring({
      label: suggestion.label,
      amount: suggestion.amount,
      type: 'expense',
      category: suggestion.category,
      dayOfMonth: suggestion.dayOfMonth,
      active: true,
      startMonth: month,
      lastGenerated: seen || suggestion.dayOfMonth <= today.getDate() ? month : undefined,
    })
    toast(`${suggestion.label} ajouté aux charges fixes`)
  }

  const hour = today.getHours()
  const progress = Math.min(Math.max(f.progress, 0), 1)

  return (
    <div>
      <header className="flex items-center justify-between px-1 pt-3">
        <div>
          <p className="text-[14px] text-muted">{hour >= 18 || hour < 5 ? 'Bonsoir' : 'Bonjour'} !</p>
          <p className="text-[17px] font-medium">{monthName(today)}</p>
        </div>
        {store.mode === 'cloud' && (!online || pending > 0) && (
          <span className="card flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium text-muted">
            <Icon name={online ? 'cloud' : 'cloudOff'} size={14} />
            {online ? 'Synchro…' : 'Hors ligne'}
          </span>
        )}
      </header>

      <h1 className="mt-5 px-1 text-[34px] leading-[1.1] font-medium tracking-[-0.025em]">
        {!hasBudget ? 'Dépensé' : f.remaining >= 0 ? 'Reste à dépenser' : 'Dépassement'}
        <span className="block font-light text-muted">ce mois-ci</span>
      </h1>

      <section className="card mt-4 overflow-hidden rounded-[28px]">
        <div className="px-5 pt-4 pb-3.5">
          <Amount value={money(hasBudget ? Math.abs(f.remaining) : f.spent)} className="block text-[52px] leading-[1.15] font-normal tracking-[-0.045em]" />
          {hasBudget ? (
            <div className="mt-1 flex items-center justify-between gap-3 text-[13px] text-muted">
              <span>
                sur <span className="num text-ink">{moneyShort(f.budget)}</span>
              </span>
              <span className="truncate">
                <span className="num text-ink">{moneyRound(f.perDay)}</span> / jour · {f.daysLeft} j restant{f.daysLeft > 1 ? 's' : ''}
              </span>
            </div>
          ) : (
            <p className="mt-1 text-[14px] text-muted">Fixe un budget pour savoir combien tu peux dépenser chaque jour.</p>
          )}
        </div>
        {hasBudget ? (
          // bandeau : partie vive = budget consommé, trait blanc = là où l'on devrait en être aujourd'hui
          <div className="relative h-[50px]" role="img" aria-label={`${Math.round(progress * 100)} % du budget utilisé, ${Math.round(f.elapsed * 100)} % du mois écoulé`}>
            <div className="absolute inset-0" style={{ background: BAND[f.status], opacity: 'var(--iri-rest)' }} />
            <div className="absolute inset-0" style={{ background: BAND[f.status], clipPath: `inset(0 ${100 - progress * 100}% 0 0)`, transition: 'clip-path .9s cubic-bezier(.2,.8,.2,1)' }} />
            {f.status !== 'exceeded' && <div className="absolute inset-y-2 w-[2px] rounded-full bg-white/90" style={{ left: `calc(${Math.min(Math.max(f.elapsed, 0.02), 0.98) * 100}% - 1px)` }} />}
            <p className="relative flex h-full items-center px-5 text-[14px] font-medium text-[var(--iri-ink)]">
              <span className="truncate">{statusText(f)}</span>
            </p>
          </div>
        ) : (
          <div className="iri flex h-[56px] items-center justify-between px-5">
            <span className="text-[14px] font-medium">Aucun budget défini</span>
            <button onClick={() => setTab('settings')} className="press rounded-full bg-[#0b0b10] px-4 py-2 text-[14px] font-medium text-white">
              Définir
            </button>
          </div>
        )}
      </section>

      <SectionTitle>Aperçu</SectionTitle>
      <div className="grid grid-cols-2 gap-2.5">
        {hasBudget && (
          <>
            <Tile icon="sun" label="Aujourd'hui" value={money(Math.abs(todayLeft))} sign={todayLeft < 0 ? '−' : ''} hint={todayLeft >= 0 ? 'encore dispo' : 'de trop'} tone={todayLeft < 0 ? 'warn' : 'good'} />
            <Tile icon="trend" label="Fin de mois" value={money(f.projected)} hint="prévision" tone={f.projected > f.budget ? 'warn' : undefined} onClick={() => setTab('insights')} />
          </>
        )}
        <Tile
          icon="repeat"
          label="Charges fixes"
          value={money(f.fixedPaid + f.fixedUpcoming)}
          hint={f.fixedUpcoming > 0 ? `dont ${moneyShort(f.fixedUpcoming)} à venir` : f.fixedPaid > 0 ? 'toutes passées' : 'aucune ce mois-ci'}
          onClick={() => setTab('settings')}
        />
        {f.income > 0 ? (
          <Tile icon="wallet" label="Solde" value={money(Math.abs(balance))} sign={balance >= 0 ? '+' : '−'} hint={`${moneyShort(f.income)} de revenus`} tone={balance >= 0 ? 'good' : 'bad'} onClick={() => setTab('insights')} />
        ) : (
          <Tile icon="wallet" label="Revenus" value={money(0)} hint="tape « +1800 salaire »" onClick={openQuickAdd} />
        )}
      </div>

      {suggestion && (
        <Card className="fade-up mt-3">
          <p className="flex items-center gap-1.5 text-[13px] font-medium text-accent">
            <Icon name="sparkle" size={15} />
            Dépense récurrente détectée
          </p>
          <p className="mt-1.5 text-[16px] leading-snug">
            <b>{suggestion.label}</b> revient chaque mois (environ {money(suggestion.amount)}, vers le {suggestion.dayOfMonth}). La passer en charge fixe, hors budget ?
          </p>
          <div className="mt-3.5 flex gap-2">
            <button onClick={addSuggestion} className="press accent-grad rounded-full px-4 py-2 text-[15px] font-semibold">
              Oui, automatiser
            </button>
            <button onClick={() => store.saveSettings({ dismissedSuggestions: [...settings.dismissedSuggestions, suggestion.key] })} className="press rounded-full bg-chip px-4 py-2 text-[15px] font-medium text-muted">
              Non merci
            </button>
          </div>
        </Card>
      )}

      {insight && !suggestion && (
        <button onClick={() => setTab('insights')} className="press mt-3 block w-full text-left">
          <Card className="flex items-center gap-3 !py-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-chip text-[22px]">{insight.icon}</span>
            <div className="min-w-0 flex-1">
              <p className={`text-[16px] font-semibold ${insight.tone === 'warn' ? 'text-warn' : insight.tone === 'good' ? 'text-good' : ''}`}>{insight.title}</p>
              <p className="mt-0.5 text-[14px] text-muted">{insight.text}</p>
            </div>
            <Icon name="chevronRight" size={18} className="text-muted" />
          </Card>
        </button>
      )}

      {upcoming.length > 0 && (
        <>
          <SectionTitle>À venir ce mois-ci</SectionTitle>
          <div className="card divide-y divide-line overflow-hidden rounded-3xl">
            {upcoming.slice(0, 4).map((u) => (
              <div key={u.id} className="flex items-center gap-3 px-4 py-3">
                <CategoryIcon id={u.category} size={42} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[16px] font-medium">{u.label}</div>
                  <div className="text-[13px] text-muted">{u.inDays === 1 ? 'Demain' : `Dans ${u.inDays} jours`} · le {u.day}</div>
                </div>
                <div className={`num text-[16px] font-medium ${u.type === 'income' ? 'text-good' : 'text-muted'}`}>
                  {u.type === 'income' ? '+' : '−'}
                  {money(u.amount)}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <SectionTitle
        action={
          transactions.length > 5 && (
            <button onClick={() => openHistory()} className="press flex items-center gap-0.5 text-[14px] text-muted">
              Tout voir
              <Icon name="chevronRight" size={14} />
            </button>
          )
        }
      >
        Dernières opérations
      </SectionTitle>
      {recent.length === 0 ? (
        <div className="card rounded-3xl">
          <EmptyState emoji="✍️" title="Aucune opération" text="Tape simplement « 12,50 boulangerie » : la catégorie est devinée toute seule.">
            <button onClick={openQuickAdd} className="press accent-grad mt-5 rounded-full px-5 py-2.5 text-[15px] font-semibold">
              Ajouter ma première dépense
            </button>
          </EmptyState>
        </div>
      ) : (
        <div className="card divide-y divide-line overflow-hidden rounded-3xl">
          {recent.map((t) => (
            <button key={t.id} onClick={() => editTransaction(t)} className="press block w-full text-left">
              <TransactionRow t={t} subtitle={`${getCategory(t.category).label} · ${dateLabel(t.date)}`} />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const TONE = { good: 'text-good', warn: 'text-warn', bad: 'text-bad' } as const

function Tile({ icon, label, value, sign = '', hint, tone, onClick }: { icon: 'sun' | 'trend' | 'repeat' | 'wallet'; label: string; value: string; sign?: string; hint: string; tone?: keyof typeof TONE; onClick?: () => void }) {
  const body = (
    <>
      <div className="flex items-center gap-2 text-[13px] text-muted">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-chip text-ink">
          <Icon name={icon} size={16} strokeWidth={1.8} />
        </span>
        {label}
      </div>
      <Amount value={sign + value} className="mt-3 block truncate text-[22px] font-normal" />
      <div className={`mt-0.5 truncate text-[12px] ${tone ? TONE[tone] : 'text-muted'}`}>{hint}</div>
    </>
  )
  const cls = 'card block rounded-[24px] p-3.5 text-left'
  return onClick ? (
    <button onClick={onClick} className={`press ${cls}`}>
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  )
}
