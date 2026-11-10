import { useEffect, useState } from 'react'
import { useStore } from '../hooks/data'
import { categoriesFor, getCategory } from '../lib/categories'
import { monthKey } from '../lib/dates'
import { categorize } from '../lib/smart/categorizer'
import type { Recurring, TxType } from '../lib/types'
import { CategoryPicker } from './CategoryPicker'
import { Field, Segmented, Sheet, inputClass, parseAmount } from './ui'

/** `editing` : null = fermé, 'new' = création, sinon la récurrente à modifier. */
export function RecurringSheet({ editing, onClose }: { editing: Recurring | 'new' | null; onClose: () => void }) {
  const store = useStore()
  const [label, setLabel] = useState('')
  const [amount, setAmount] = useState('')
  const [day, setDay] = useState('1')
  const [type, setType] = useState<TxType>('expense')
  const [category, setCategory] = useState('logement')
  const [touchedCat, setTouchedCat] = useState(false)

  useEffect(() => {
    if (!editing) return
    if (editing === 'new') {
      setLabel('')
      setAmount('')
      setDay(String(new Date().getDate()))
      setType('expense')
      setCategory('logement')
      setTouchedCat(false)
    } else {
      setLabel(editing.label)
      setAmount(String(editing.amount).replace('.', ','))
      setDay(String(editing.dayOfMonth))
      setType(editing.type)
      setCategory(editing.category)
      setTouchedCat(true)
    }
  }, [editing])

  const value = parseAmount(amount)
  const d = Math.round(Number(day))
  const valid = !!label.trim() && value > 0 && d >= 1 && d <= 31

  const save = () => {
    if (!valid || !editing) return
    const data = { label: label.trim(), amount: value, dayOfMonth: d, type, category }
    if (editing === 'new') {
      const today = new Date()
      store.addRecurring({
        ...data,
        active: true,
        startMonth: monthKey(today),
        // si l'échéance de ce mois est déjà passée, on commence le mois prochain
        lastGenerated: d < today.getDate() ? monthKey(today) : undefined,
      })
    } else store.updateRecurring(editing.id, data)
    onClose()
  }

  return (
    <Sheet
      open={!!editing}
      onClose={onClose}
      title={editing === 'new' ? 'Nouvelle échéance' : 'Modifier'}
      right={
        <button onClick={save} disabled={!valid} className="press text-[17px] font-semibold text-accent disabled:opacity-30">
          {editing === 'new' ? 'Ajouter' : 'Enregistrer'}
        </button>
      }
    >
      <div className="space-y-5 px-5 pt-3 pb-6">
        <Segmented
          value={type}
          onChange={(t) => {
            setType(t)
            if (getCategory(category).type !== t) setCategory(categoriesFor(t)[0].id)
          }}
          options={[
            { value: 'expense', label: 'Dépense' },
            { value: 'income', label: 'Revenu' },
          ]}
        />
        <Field label="Nom">
          <input
            value={label}
            placeholder="Loyer, Netflix, Salaire…"
            onChange={(e) => {
              setLabel(e.target.value)
              if (!touchedCat) setCategory(categorize(e.target.value, type).category)
            }}
            className={inputClass}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Montant (€)">
            <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className={`${inputClass} tabular`} />
          </Field>
          <Field label="Jour du mois">
            <input inputMode="numeric" value={day} onChange={(e) => setDay(e.target.value)} className={`${inputClass} tabular`} />
          </Field>
        </div>
        <div>
          <span className="mb-1.5 block px-1 text-[13px] text-muted">Catégorie</span>
          <CategoryPicker
            type={type}
            value={category}
            onChange={(c) => {
              setCategory(c)
              setTouchedCat(true)
            }}
          />
        </div>
        <p className="px-1 text-[13px] text-muted">
          {d > 28 && d <= 31 ? `Les mois plus courts, elle tombera le dernier jour du mois. ` : ''}
          {type === 'income' ? 'Ce revenu sera ajouté' : 'Cette charge sera ajoutée'} automatiquement chaque mois à cette date.
        </p>
        {editing && editing !== 'new' && (
          <button
            onClick={() => {
              store.deleteRecurring(editing.id)
              onClose()
            }}
            className="press w-full rounded-2xl bg-bad/10 py-3.5 text-[16px] font-semibold text-bad"
          >
            Supprimer cette échéance
          </button>
        )}
      </div>
    </Sheet>
  )
}
