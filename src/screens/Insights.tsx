import { useMemo, useState } from 'react'
import { Donut } from '../components/Donut'
import { Card, CategoryIcon, SectionTitle } from '../components/ui'
import { useData } from '../hooks/data'
import { getCategory } from '../lib/categories'
import { addMonths, fromKey, monthKey, monthOf } from '../lib/dates'
import { moneyShort, monthName } from '../lib/format'
import { generateInsights, totalsByCategory } from '../lib/smart/insights'

const shortMonth = new Intl.DateTimeFormat('fr-FR', { month: 'short' })

export function Insights() {
  const { transactions, settings, recurring } = useData()
  const current = monthKey(new Date())
  const [month, setMonth] = useState(current)
  const oldest = transactions.length ? monthOf(transactions[transactions.length - 1].date) : current

  const totals = useMemo(() => totalsByCategory(transactions, month), [transactions, month])
  const total = totals.reduce((s, c) => s + c.total, 0)
  const insights = useMemo(() => generateInsights(transactions, month, new Date(), recurring.map((r) => r.label)), [transactions, month, recurring])

  const months = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => addMonths(month, i - 5)).map((m) => ({
      m,
      total: transactions.filter((t) => t.type === 'expense' && monthOf(t.date) === m).reduce((s, t) => s + t.amount, 0),
    }))
  }, [transactions, month])
  const maxBar = Math.max(settings.monthlyBudget, ...months.map((x) => x.total), 1)

  return (
    <div className="fade-up">
      <h1 className="px-1 pt-2 text-[34px] font-bold tracking-tight">Analyse</h1>

      <div className="mt-3 flex items-center justify-between">
        <button onClick={() => setMonth(addMonths(month, -1))} disabled={month <= oldest} className="press h-10 w-10 rounded-full text-[22px] text-accent disabled:opacity-20" aria-label="Mois précédent">
          ‹
        </button>
        <span className="text-[17px] font-semibold">{monthName(fromKey(month))}</span>
        <button onClick={() => setMonth(addMonths(month, 1))} disabled={month >= current} className="press h-10 w-10 rounded-full text-[22px] text-accent disabled:opacity-20" aria-label="Mois suivant">
          ›
        </button>
      </div>

      <div className="mt-4">
        <Donut data={totals.map((c) => ({ value: c.total, color: getCategory(c.category).color }))}>
          <span className="text-[13px] text-muted">Dépenses</span>
          <span className="tabular text-[28px] font-semibold tracking-tight">{moneyShort(total)}</span>
        </Donut>
      </div>

      {totals.length > 0 && (
        <div className="mt-6 space-y-3">
          {totals.map((c) => {
            const cat = getCategory(c.category)
            const share = total ? c.total / total : 0
            return (
              <div key={c.category} className="flex items-center gap-3">
                <CategoryIcon id={c.category} size={36} />
                <div className="min-w-0 flex-1">
                  <div className="flex justify-between text-[15px]">
                    <span className="truncate">{cat.label}</span>
                    <span className="tabular font-medium">{moneyShort(c.total)}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-card">
                    <div className="h-full rounded-full" style={{ width: `${share * 100}%`, background: cat.color, transition: 'width .6s' }} />
                  </div>
                </div>
                <span className="tabular w-10 text-right text-[13px] text-muted">{Math.round(share * 100)} %</span>
              </div>
            )
          })}
        </div>
      )}

      {insights.length > 0 && (
        <>
          <SectionTitle>Conseils</SectionTitle>
          <div className="space-y-2">
            {insights.map((i) => (
              <Card key={i.id} className="flex items-start gap-3 !py-4">
                <span className="text-[22px]">{i.icon}</span>
                <div>
                  <p className={`text-[16px] font-medium ${i.tone === 'warn' ? 'text-warn' : i.tone === 'good' ? 'text-good' : ''}`}>{i.title}</p>
                  <p className="mt-0.5 text-[14px] text-muted">{i.text}</p>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      <SectionTitle>6 derniers mois</SectionTitle>
      <Card>
        <div className="relative flex h-40 items-end gap-3">
          {settings.monthlyBudget > 0 && (
            <div className="absolute inset-x-0 border-t border-dashed border-muted/60" style={{ bottom: `${(settings.monthlyBudget / maxBar) * 100}%` }}>
              <span className="absolute -top-4 right-0 text-[10px] text-muted">budget</span>
            </div>
          )}
          {months.map((x) => (
            <button key={x.m} onClick={() => setMonth(x.m)} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
              <span className="tabular text-[10px] text-muted">{x.total ? moneyShort(x.total) : ''}</span>
              <div
                className="w-full rounded-lg"
                style={{
                  height: `${Math.max((x.total / maxBar) * 100, 2)}%`,
                  background: x.m === month ? (settings.monthlyBudget && x.total > settings.monthlyBudget ? 'var(--bad)' : 'var(--ink)') : 'var(--card2)',
                  transition: 'height .6s',
                }}
              />
            </button>
          ))}
        </div>
        <div className="mt-2 flex gap-3">
          {months.map((x) => (
            <span key={x.m} className={`flex-1 text-center text-[11px] ${x.m === month ? 'font-semibold' : 'text-muted'}`}>
              {shortMonth.format(fromKey(x.m)).replace('.', '')}
            </span>
          ))}
        </div>
      </Card>
    </div>
  )
}
