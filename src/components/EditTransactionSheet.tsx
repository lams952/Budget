import { useEffect, useState } from 'react'
import { useStore } from '../hooks/data'
import { categoriesFor, getCategory } from '../lib/categories'
import { learnKey } from '../lib/smart/categorizer'
import type { Transaction, TxType } from '../lib/types'
import { CategoryPicker } from './CategoryPicker'
import { Field, Segmented, Sheet, inputClass } from './ui'

export function EditTransactionSheet({ tx, onClose, onDone }: { tx: Transaction | null; onClose: () => void; onDone: (msg: string) => void }) {
  const store = useStore()
  const [amount, setAmount] = useState('')
  const [label, setLabel] = useState('')
  const [type, setType] = useState<TxType>('expense')
  const [category, setCategory] = useState('autre')
  const [date, setDate] = useState('')

  useEffect(() => {
    if (!tx) return
    setAmount(String(tx.amount).replace('.', ','))
    setLabel(tx.label)
    setType(tx.type)
    setCategory(tx.category)
    setDate(tx.date)
  }, [tx])

  const value = Number(amount.replace(/\s/g, '').replace(',', '.'))
  const valid = value > 0 && date

  const save = () => {
    if (!tx || !valid) return
    store.updateTransaction(tx.id, { amount: value, label: label.trim(), type, category, date })
    if (category !== tx.category && label.trim()) store.learn(learnKey(label), category)
    onDone('Modifié ✓')
    onClose()
  }

  return (
    <Sheet
      open={!!tx}
      onClose={onClose}
      title="Modifier"
      right={
        <button onClick={save} disabled={!valid} className="press text-[17px] font-semibold text-accent disabled:opacity-30">
          OK
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
        <Field label="Montant">
          <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className={`${inputClass} tabular text-[22px] font-semibold`} />
        </Field>
        <Field label="Description">
          <input value={label} onChange={(e) => setLabel(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Date">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${inputClass} appearance-none`} />
        </Field>
        <div>
          <span className="mb-1.5 block px-1 text-[13px] text-muted">Catégorie</span>
          <CategoryPicker type={type} value={category} onChange={setCategory} />
        </div>
        <button
          onClick={() => {
            if (!tx) return
            store.deleteTransaction(tx.id)
            onDone('Supprimé')
            onClose()
          }}
          className="press w-full rounded-2xl bg-field py-3.5 text-[17px] font-medium text-bad"
        >
          Supprimer
        </button>
      </div>
    </Sheet>
  )
}
