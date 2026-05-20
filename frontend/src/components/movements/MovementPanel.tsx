import { useState } from 'react'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { Plus, Trash2, TrendingUp, TrendingDown, Minus, Printer } from 'lucide-react'
import {
  useRecordMovements,
  useRecordBalance,
  useCreateMovement,
  useDeleteMovement,
} from '@/hooks/useMovements'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Spinner from '@/components/ui/Spinner'
import Modal from '@/components/ui/Modal'
import type { MovementType } from '@/types/movement'
import { MOVEMENT_LABELS } from '@/types/movement'

const TYPE_ICON = {
  receipt: <TrendingUp size={14} className="text-emerald-500" />,
  expenditure: <TrendingDown size={14} className="text-red-500" />,
  write_off: <Minus size={14} className="text-slate-400" />,
}
const TYPE_BADGE_VARIANT: Record<MovementType, 'green' | 'red' | 'gray'> = {
  receipt: 'green',
  expenditure: 'red',
  write_off: 'gray',
}

interface Props {
  entityId: string
  recordId: string
  recordLabel?: string
  entityName?: string
}

export default function MovementPanel({ entityId, recordId, recordLabel, entityName }: Props) {
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState({
    movement_type: 'receipt' as MovementType,
    quantity: '',
    unit: '',
    notes: '',
    reference_number: '',
    performed_at: '',
  })

  const { data: movements, isLoading } = useRecordMovements(entityId, recordId)
  const { data: balance } = useRecordBalance(entityId, recordId)
  const createMovement = useCreateMovement(entityId, recordId)
  const deleteMovement = useDeleteMovement(entityId, recordId)

  const handleCreate = () => {
    const qty = parseFloat(form.quantity)
    if (!qty || qty <= 0) return
    createMovement.mutate(
      {
        movement_type: form.movement_type,
        quantity: qty,
        unit: form.unit || undefined,
        notes: form.notes || undefined,
        reference_number: form.reference_number || undefined,
        performed_at: form.performed_at || undefined,
      },
      {
        onSuccess: () => {
          setCreateOpen(false)
          setForm({ movement_type: 'receipt', quantity: '', unit: '', notes: '', reference_number: '', performed_at: '' })
        },
      }
    )
  }

  const printInvoice = () => {
    const win = window.open('', '_blank')
    if (!win) return
    const rows = movements?.map((m) =>
      `<tr>
        <td>${MOVEMENT_LABELS[m.movement_type]}</td>
        <td>${format(new Date(m.performed_at), 'dd.MM.yyyy HH:mm')}</td>
        <td>${m.quantity}${m.unit ? ' ' + m.unit : ''}</td>
        <td>${m.reference_number ?? '—'}</td>
        <td>${m.notes ?? '—'}</td>
      </tr>`
    ).join('')
    win.document.write(`
      <html><head><title>Накладная — ${recordLabel ?? recordId}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 24px; }
        h2 { margin-bottom: 4px; }
        p { color: #666; margin: 0 0 16px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; font-size: 13px; }
        th { background: #f5f5f5; font-weight: 600; }
        .balance { margin-top: 16px; font-size: 14px; }
        .balance strong { font-size: 18px; }
        @media print { button { display: none; } }
      </style></head><body>
      <h2>Накладная</h2>
      <p>Сущность: ${entityName ?? entityId} · Запись: ${recordLabel ?? recordId}</p>
      <table>
        <thead><tr><th>Тип</th><th>Дата</th><th>Количество</th><th>№ документа</th><th>Примечание</th></tr></thead>
        <tbody>${rows ?? ''}</tbody>
      </table>
      ${balance ? `<div class="balance">
        Приход: <strong>${balance.receipt}</strong> &nbsp;
        Расход: <strong>${balance.expenditure}</strong> &nbsp;
        Списание: <strong>${balance.write_off}</strong> &nbsp;
        <strong>Остаток: ${balance.balance}${balance.unit ? ' ' + balance.unit : ''}</strong>
      </div>` : ''}
      <br/><button onclick="window.print()">Печать</button>
      </body></html>
    `)
    win.document.close()
    win.focus()
    setTimeout(() => win.print(), 400)
  }

  return (
    <div className="space-y-4">
      {/* Balance summary */}
      {balance && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Приход', val: balance.receipt, cls: 'text-emerald-600' },
            { label: 'Расход', val: balance.expenditure, cls: 'text-red-500' },
            { label: 'Списание', val: balance.write_off, cls: 'text-slate-500' },
            { label: 'Остаток', val: balance.balance, cls: balance.balance >= 0 ? 'text-emerald-700 font-bold' : 'text-red-600 font-bold' },
          ].map((item) => (
            <div key={item.label} className="bg-slate-50 rounded-xl p-3 text-center">
              <p className="text-xs text-slate-500 mb-1">{item.label}</p>
              <p className={`text-lg ${item.cls}`}>
                {item.val}{balance.unit ? ` ${balance.unit}` : ''}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-900">
          Движения товара
          {movements && <span className="text-slate-400 font-normal ml-1">({movements.length})</span>}
        </p>
        <div className="flex gap-2">
          {movements && movements.length > 0 && (
            <Button variant="secondary" size="sm" icon={<Printer size={14} />} onClick={printInvoice}>
              Накладная
            </Button>
          )}
          <Button size="sm" icon={<Plus size={14} />} onClick={() => setCreateOpen(true)}>
            Добавить
          </Button>
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-8"><Spinner /></div>
      ) : !movements?.length ? (
        <div className="text-center py-8 text-sm text-slate-400 bg-slate-50 rounded-xl">
          Нет операций — добавьте первое движение
        </div>
      ) : (
        <div className="space-y-1.5">
          {movements.map((m) => (
            <div
              key={m.id}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-50 group"
            >
              {TYPE_ICON[m.movement_type]}
              <Badge variant={TYPE_BADGE_VARIANT[m.movement_type]}>
                {MOVEMENT_LABELS[m.movement_type]}
              </Badge>
              <span className="font-semibold text-slate-900 text-sm">
                {m.quantity}{m.unit ? ` ${m.unit}` : ''}
              </span>
              {m.reference_number && (
                <span className="text-xs text-slate-400">#{m.reference_number}</span>
              )}
              {m.notes && (
                <span className="text-xs text-slate-500 truncate flex-1">{m.notes}</span>
              )}
              <span className="text-xs text-slate-400 ml-auto shrink-0">
                {format(new Date(m.performed_at), 'dd MMM yyyy', { locale: ru })}
              </span>
              <button
                onClick={() => deleteMovement.mutate(m.id)}
                className="opacity-0 group-hover:opacity-100 p-1 rounded text-slate-300 hover:text-red-500 transition-all"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Create modal */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Добавить операцию"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>Отмена</Button>
            <Button
              onClick={handleCreate}
              loading={createMovement.isPending}
              disabled={!form.quantity || parseFloat(form.quantity) <= 0}
            >
              Добавить
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {/* Type */}
          <div>
            <label className="label">Тип операции</label>
            <div className="grid grid-cols-3 gap-2 mt-1.5">
              {(['receipt', 'expenditure', 'write_off'] as MovementType[]).map((t) => (
                <label
                  key={t}
                  className={`flex items-center justify-center gap-1.5 py-2 rounded-xl border-2 cursor-pointer text-sm font-medium transition-all ${
                    form.movement_type === t
                      ? t === 'receipt'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                        : t === 'expenditure'
                        ? 'border-red-500 bg-red-50 text-red-700'
                        : 'border-slate-400 bg-slate-100 text-slate-700'
                      : 'border-slate-200 text-slate-500 hover:border-slate-300'
                  }`}
                >
                  <input
                    type="radio"
                    className="sr-only"
                    checked={form.movement_type === t}
                    onChange={() => setForm((f) => ({ ...f, movement_type: t }))}
                  />
                  {TYPE_ICON[t]}
                  {MOVEMENT_LABELS[t]}
                </label>
              ))}
            </div>
          </div>

          {/* Quantity + Unit */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Количество <span className="text-red-500">*</span></label>
              <input
                type="number"
                step="any"
                min="0"
                className="input"
                placeholder="0"
                value={form.quantity}
                onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">Единица измерения</label>
              <input
                className="input"
                placeholder="шт, кг, л..."
                value={form.unit}
                onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
              />
            </div>
          </div>

          {/* Reference + Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">№ документа</label>
              <input
                className="input"
                placeholder="Накладная №..."
                value={form.reference_number}
                onChange={(e) => setForm((f) => ({ ...f, reference_number: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">Дата операции</label>
              <input
                type="datetime-local"
                className="input"
                value={form.performed_at}
                onChange={(e) => setForm((f) => ({ ...f, performed_at: e.target.value }))}
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="label">Примечание</label>
            <textarea
              className="input resize-none"
              rows={2}
              placeholder="Необязательно..."
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </div>
        </div>
      </Modal>
    </div>
  )
}
