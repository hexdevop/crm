import { useNavigate, useParams } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { ArrowLeft, Plus, Trash2, GripVertical, Save, X, ChevronDown, ChevronUp } from 'lucide-react'
import { useEntity, useCreateEntity, useUpdateEntity, useEntities } from '@/hooks/useEntities'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Card, { CardHeader, CardBody } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Spinner from '@/components/ui/Spinner'
import toast from 'react-hot-toast'
import type { FieldType, EntityFieldCreate } from '@/types/entity'
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  verticalListSortingStrategy, useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const FIELD_TYPES: { type: FieldType; label: string; icon: string; desc: string }[] = [
  { type: 'text',               label: 'Текст',              icon: '📝', desc: 'Строка текста' },
  { type: 'number',             label: 'Число',              icon: '🔢', desc: 'Числовое значение' },
  { type: 'price',              label: 'Цена / Валюта',      icon: '💰', desc: 'Число с валютой и форматированием' },
  { type: 'quantity_unit',      label: 'Количество + ед.',   icon: '⚖️', desc: 'Число с единицей измерения' },
  { type: 'autoincrement',      label: 'Артикул (авто №)',   icon: '🔖', desc: 'Автоматически генерируемый уникальный номер' },
  { type: 'formula',            label: 'Формула',            icon: '🧮', desc: 'Вычисляемое поле (Сумма = Кол × Цена)' },
  { type: 'currency_convert',   label: 'Конвертация валют',  icon: '💱', desc: 'Автоматический перевод суммы в другую валюту по курсу' },
  { type: 'email',              label: 'Email',              icon: '📧', desc: 'Адрес эл. почты' },
  { type: 'phone',              label: 'Телефон',            icon: '📱', desc: 'Номер телефона' },
  { type: 'date',               label: 'Дата',               icon: '📅', desc: 'Дата (ГГГГ-ММ-ДД)' },
  { type: 'expiry_date',        label: 'Срок годности',      icon: '⏰', desc: 'Дата + уведомление об истечении' },
  { type: 'boolean',            label: 'Да / Нет',           icon: '✅', desc: 'Флаг / чекбокс' },
  { type: 'select',             label: 'Список',             icon: '📋', desc: 'Выпадающий список' },
  { type: 'status',             label: 'Статус',             icon: '🚦', desc: 'Статус с цветовой индикацией' },
  { type: 'image',              label: 'Фото / Изображение', icon: '🖼️', desc: 'Загрузка фотографии товара' },
  { type: 'file',               label: 'Файл / Документ',   icon: '📎', desc: 'Прикрепить накладную, сертификат, паспорт' },
  { type: 'warehouse_location', label: 'Ячейка на складе',  icon: '📍', desc: 'Адрес хранения: Стеллаж-Полка-Ячейка' },
  { type: 'barcode',            label: 'Штрихкод / QR',     icon: '🔲', desc: 'Штрихкод или QR-код товара' },
  { type: 'relation',           label: 'Связь',              icon: '🔗', desc: 'Ссылка на запись другой сущности' },
  { type: 'url',               label: 'Ссылка / URL',       icon: '🌐', desc: 'Веб-адрес, гиперссылка' },
]

const COLORS = ['#6366f1','#8b5cf6','#ec4899','#ef4444','#f97316','#eab308','#22c55e','#06b6d4','#3b82f6','#64748b']
const ICONS  = ['📋','👤','🏢','💼','📦','🎯','🔑','📊','💬','🗂️','🏷️','📌','⚡','🔔','💡']

const FIELD_TYPE_COLORS: Record<string, string> = {
  text: '#6366f1', email: '#6366f1', phone: '#6366f1', barcode: '#6366f1', url: '#6366f1',
  number: '#22c55e', price: '#22c55e', quantity_unit: '#22c55e', formula: '#22c55e', currency_convert: '#22c55e',
  date: '#f97316', expiry_date: '#f97316',
  select: '#3b82f6', status: '#3b82f6', boolean: '#3b82f6',
  relation: '#8b5cf6',
  image: '#06b6d4', file: '#06b6d4',
  autoincrement: '#64748b', warehouse_location: '#64748b',
}

interface SelectOption { value: string; label: string }

interface FieldDraft extends EntityFieldCreate {
  _id: string
  _expanded?: boolean
}

function slugifyEntity(str: string) {
  return str.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-zа-яё0-9-]/g, '').slice(0, 50)
}
function slugifyField(str: string) {
  return str.toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-zа-яё0-9_]/g, '').slice(0, 50)
}

// ─── SELECT Options Editor ──────────────────────────────────────────────────
function SelectOptionsEditor({
  options, onChange,
}: { options: SelectOption[]; onChange: (o: SelectOption[]) => void }) {
  const add = () => {
    const n = options.length + 1
    onChange([...options, { value: `option_${n}`, label: `Вариант ${n}` }])
  }
  const remove = (i: number) => onChange(options.filter((_, idx) => idx !== i))
  const update = (i: number, k: 'value' | 'label', v: string) =>
    onChange(options.map((o, idx) => idx === i ? { ...o, [k]: v } : o))

  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Варианты списка</span>
        <button type="button" onClick={add}
          className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 font-medium">
          <Plus size={12} /> Добавить
        </button>
      </div>
      {options.length === 0 && (
        <p className="text-xs text-slate-400 italic py-1">Нет вариантов — добавьте хотя бы один</p>
      )}
      <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
        {options.map((opt, i) => (
          <div key={i} className="flex items-center gap-2 bg-slate-50 rounded-lg px-2 py-1.5">
            <div className="flex-1 grid grid-cols-2 gap-2">
              <input
                className="text-xs border border-slate-200 rounded px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 font-mono"
                placeholder="значение (id)"
                value={opt.value}
                onChange={(e) => update(i, 'value', e.target.value.replace(/\s+/g, '_').toLowerCase())}
              />
              <input
                className="text-xs border border-slate-200 rounded px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
                placeholder="отображение"
                value={opt.label}
                onChange={(e) => update(i, 'label', e.target.value)}
              />
            </div>
            <button type="button" onClick={() => remove(i)}
              className="text-slate-300 hover:text-red-500 transition-colors shrink-0">
              <X size={13} />
            </button>
          </div>
        ))}
      </div>
      {options.length > 0 && (
        <p className="text-xs text-slate-400">«значение» — сохраняется в БД · «отображение» — видит пользователь</p>
      )}
    </div>
  )
}

// ─── NUMBER Config Editor ───────────────────────────────────────────────────
function NumberConfigEditor({ config, onChange }: {
  config: Record<string, unknown>
  onChange: (c: Record<string, unknown>) => void
}) {
  return (
    <div className="mt-3 grid grid-cols-2 gap-3">
      <div>
        <label className="text-xs text-slate-500 mb-1 block">Минимальное значение</label>
        <input type="number"
          className="text-xs border border-slate-200 rounded px-2 py-1.5 w-full bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
          placeholder="без ограничения"
          value={config.min !== undefined ? String(config.min) : ''}
          onChange={(e) => onChange({ ...config, min: e.target.value === '' ? undefined : Number(e.target.value) })} />
      </div>
      <div>
        <label className="text-xs text-slate-500 mb-1 block">Максимальное значение</label>
        <input type="number"
          className="text-xs border border-slate-200 rounded px-2 py-1.5 w-full bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
          placeholder="без ограничения"
          value={config.max !== undefined ? String(config.max) : ''}
          onChange={(e) => onChange({ ...config, max: e.target.value === '' ? undefined : Number(e.target.value) })} />
      </div>
    </div>
  )
}

// ─── EXPIRY DATE Config Editor ──────────────────────────────────────────────
function ExpiryConfigEditor({ config, onChange }: {
  config: Record<string, unknown>
  onChange: (c: Record<string, unknown>) => void
}) {
  return (
    <div className="mt-3 space-y-2">
      <div>
        <label className="text-xs text-slate-500 mb-1 block">Уведомлять за N дней до истечения</label>
        <input type="number" min="1" max="365"
          className="text-xs border border-slate-200 rounded px-2 py-1.5 w-full bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
          placeholder="30"
          value={config.warn_days !== undefined ? String(config.warn_days) : ''}
          onChange={(e) => onChange({ ...config, warn_days: e.target.value === '' ? 30 : Number(e.target.value) })} />
      </div>
    </div>
  )
}

// ─── QUANTITY_UNIT Config Editor ─────────────────────────────────────────────
function QuantityUnitConfigEditor({ config, onChange }: {
  config: Record<string, unknown>
  onChange: (c: Record<string, unknown>) => void
}) {
  const units: string[] = (config.units as string[]) ?? ['шт', 'кг', 'л', 'м', 'м²', 'м³']
  const addUnit = (u: string) => {
    if (u && !units.includes(u)) onChange({ ...config, units: [...units, u] })
  }
  const removeUnit = (u: string) => onChange({ ...config, units: units.filter((x) => x !== u) })
  return (
    <div className="mt-3 space-y-2">
      <div>
        <label className="text-xs text-slate-500 mb-1 block">Единица по умолчанию</label>
        <input className="text-xs border border-slate-200 rounded px-2 py-1.5 w-full bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
          placeholder="шт"
          value={String(config.default_unit ?? '')}
          onChange={(e) => onChange({ ...config, default_unit: e.target.value })} />
      </div>
      <div>
        <label className="text-xs text-slate-500 mb-1 block">Доступные единицы</label>
        <div className="flex flex-wrap gap-1 mb-1">
          {units.map((u) => (
            <span key={u} className="inline-flex items-center gap-1 bg-slate-100 rounded px-2 py-0.5 text-xs">
              {u}
              <button type="button" onClick={() => removeUnit(u)} className="text-slate-400 hover:text-red-500">
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
        <input className="text-xs border border-slate-200 rounded px-2 py-1.5 w-full bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
          placeholder="Добавить единицу..."
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); addUnit(e.currentTarget.value.trim()); e.currentTarget.value = '' }
          }} />
        <p className="text-xs text-slate-400 mt-0.5">Нажмите Enter чтобы добавить</p>
      </div>
    </div>
  )
}

// ─── RELATION Config Editor ──────────────────────────────────────────────────
function RelationConfigEditor({ config, onChange, currentEntityId }: {
  config: Record<string, unknown>
  onChange: (c: Record<string, unknown>) => void
  currentEntityId?: string
}) {
  const { data: entities } = useEntities()
  const available = entities?.filter((e) => e.id !== currentEntityId) ?? []
  const selectedEntity = available.find((e) => e.id === config.entity_id)

  return (
    <div className="mt-3 space-y-2">
      <div>
        <label className="text-xs text-slate-500 mb-1 block">Связанная сущность</label>
        <select
          className="text-xs border border-slate-200 rounded px-2 py-1.5 w-full bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
          value={String(config.entity_id ?? '')}
          onChange={(e) => {
            const ent = available.find((x) => x.id === e.target.value)
            onChange({ ...config, entity_id: e.target.value, entity_name: ent?.name ?? '' })
          }}
        >
          <option value="">— выберите —</option>
          {available.map((e) => (
            <option key={e.id} value={e.id}>{e.icon ?? '📋'} {e.name}</option>
          ))}
        </select>
      </div>
      {selectedEntity && (
        <div>
          <label className="text-xs text-slate-500 mb-1 block">Отображаемое поле</label>
          <select
            className="text-xs border border-slate-200 rounded px-2 py-1.5 w-full bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
            value={String(config.display_field ?? '')}
            onChange={(e) => onChange({ ...config, display_field: e.target.value })}
          >
            <option value="">— выберите поле —</option>
            {selectedEntity.fields.map((f) => (
              <option key={f.id} value={f.slug}>{f.name} ({f.field_type})</option>
            ))}
          </select>
        </div>
      )}
    </div>
  )
}

// ─── PRICE Config Editor ─────────────────────────────────────────────────────
function PriceConfigEditor({ config, onChange }: {
  config: Record<string, unknown>
  onChange: (c: Record<string, unknown>) => void
}) {
  const CURRENCIES = [
    { code: 'UZS', symbol: 'сум' }, { code: 'USD', symbol: '$' },
    { code: 'EUR', symbol: '€' }, { code: 'RUB', symbol: '₽' },
    { code: 'KZT', symbol: '₸' },
  ]
  return (
    <div className="mt-3 grid grid-cols-2 gap-3">
      <div>
        <label className="text-xs text-slate-500 mb-1 block">Валюта</label>
        <select
          className="text-xs border border-slate-200 rounded px-2 py-1.5 w-full bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
          value={String(config.currency ?? 'UZS')}
          onChange={(e) => {
            const cur = CURRENCIES.find((c) => c.code === e.target.value)
            onChange({ ...config, currency: e.target.value, symbol: cur?.symbol ?? e.target.value })
          }}
        >
          {CURRENCIES.map((c) => (
            <option key={c.code} value={c.code}>{c.code} — {c.symbol}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-xs text-slate-500 mb-1 block">Знаков после запятой</label>
        <input type="number" min="0" max="4"
          className="text-xs border border-slate-200 rounded px-2 py-1.5 w-full bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
          placeholder="2"
          value={config.decimals !== undefined ? String(config.decimals) : ''}
          onChange={(e) => onChange({ ...config, decimals: e.target.value === '' ? 2 : Number(e.target.value) })} />
      </div>
    </div>
  )
}

// ─── AUTOINCREMENT Config Editor ─────────────────────────────────────────────
function AutoincrementConfigEditor({ config, onChange }: {
  config: Record<string, unknown>
  onChange: (c: Record<string, unknown>) => void
}) {
  return (
    <div className="mt-3 space-y-2">
      <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-700">
        Значение генерируется автоматически при создании записи. Пользователь не может его изменить.
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-xs text-slate-500 mb-1 block">Префикс</label>
          <input className="text-xs border border-slate-200 rounded px-2 py-1.5 w-full bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
            placeholder="ART-"
            value={String(config.prefix ?? '')}
            onChange={(e) => onChange({ ...config, prefix: e.target.value })} />
        </div>
        <div>
          <label className="text-xs text-slate-500 mb-1 block">Следующий №</label>
          <input type="number" min="1"
            className="text-xs border border-slate-200 rounded px-2 py-1.5 w-full bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
            value={config.next_value !== undefined ? String(config.next_value) : '1'}
            onChange={(e) => onChange({ ...config, next_value: Number(e.target.value) })} />
        </div>
        <div>
          <label className="text-xs text-slate-500 mb-1 block">Ширина числа</label>
          <input type="number" min="1" max="10"
            className="text-xs border border-slate-200 rounded px-2 py-1.5 w-full bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
            placeholder="6"
            value={config.padding !== undefined ? String(config.padding) : '6'}
            onChange={(e) => onChange({ ...config, padding: Number(e.target.value) })} />
        </div>
      </div>
      <p className="text-xs text-slate-400">
        Пример: префикс «ART-», ширина 6 → <code className="bg-slate-100 px-1 rounded">ART-000001</code>
      </p>
    </div>
  )
}

// ─── FORMULA Config Editor ───────────────────────────────────────────────────
function FormulaConfigEditor({ config, onChange, fields }: {
  config: Record<string, unknown>
  onChange: (c: Record<string, unknown>) => void
  fields: FieldDraft[]
}) {
  const numericFields = fields.filter((f) =>
    ['number', 'price', 'quantity_unit'].includes(f.field_type)
  )
  const prefix = String(config.prefix ?? '')
  const suffix = String(config.suffix ?? '')
  const previewNum = '1234.5'
  const preview = `${prefix}${previewNum}${suffix}`
  return (
    <div className="mt-3 space-y-2">
      <div>
        <label className="text-xs text-slate-500 mb-1 block">Формула (используйте slug полей)</label>
        <input
          className="text-xs border border-slate-200 rounded px-2 py-1.5 w-full bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 font-mono"
          placeholder="кол_во * цена"
          value={String(config.formula ?? '')}
          onChange={(e) => onChange({ ...config, formula: e.target.value })} />
      </div>
      {numericFields.length > 0 && (
        <div>
          <p className="text-xs text-slate-400 mb-1">Доступные числовые поля:</p>
          <div className="flex flex-wrap gap-1">
            {numericFields.map((f) => (
              <code key={f._id}
                className="text-xs bg-slate-100 px-1.5 py-0.5 rounded cursor-pointer hover:bg-brand-50 hover:text-brand-700"
                onClick={() => onChange({ ...config, formula: `${config.formula ?? ''} ${f.slug}`.trim() })}>
                {f.slug}
              </code>
            ))}
          </div>
        </div>
      )}
      <div>
        <p className="text-xs text-slate-400 mb-1">Курсы валют (обновляются в реальном времени):</p>
        <div className="flex flex-wrap gap-1">
          {['usd', 'eur', 'rub', 'uzs', 'kzt'].map((code) => (
            <code key={code}
              className="text-xs bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded cursor-pointer hover:bg-emerald-100"
              onClick={() => onChange({ ...config, formula: `${config.formula ?? ''} rate_${code}`.trim() })}>
              rate_{code}
            </code>
          ))}
        </div>
        <p className="text-xs text-slate-400 mt-1">
          <code className="bg-slate-100 px-1 rounded">rate_xxx</code> — курс валюты за 1 USD.
          Пример перевода из UZS в USD: <code className="bg-slate-100 px-1 rounded">цена_uzs / rate_uzs</code>
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-slate-500 mb-1 block">Префикс (перед числом)</label>
          <input
            className="text-xs border border-slate-200 rounded px-2 py-1.5 w-full bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
            placeholder="например: $"
            value={prefix}
            onChange={(e) => onChange({ ...config, prefix: e.target.value })} />
        </div>
        <div>
          <label className="text-xs text-slate-500 mb-1 block">Суффикс (после числа)</label>
          <input
            className="text-xs border border-slate-200 rounded px-2 py-1.5 w-full bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
            placeholder="например: кг"
            value={suffix}
            onChange={(e) => onChange({ ...config, suffix: e.target.value })} />
        </div>
      </div>
      {(prefix || suffix) && (
        <p className="text-xs text-slate-500">
          Пример результата: <code className="bg-blue-50 text-blue-700 px-1 rounded">{preview}</code>
        </p>
      )}
      <p className="text-xs text-slate-400">Поддерживаются: +, −, ×, ÷, скобки. Значение пересчитывается в реальном времени при вводе.</p>
    </div>
  )
}

// ─── CURRENCY CONVERT Config Editor ──────────────────────────────────────────
const CURRENCY_CODES = ['usd', 'eur', 'rub', 'uzs', 'kzt']

function CurrencyConvertConfigEditor({ config, onChange, fields }: {
  config: Record<string, unknown>
  onChange: (c: Record<string, unknown>) => void
  fields: FieldDraft[]
}) {
  const sourceFields = fields.filter((f) =>
    ['number', 'price', 'quantity_unit'].includes(f.field_type)
  )
  const decimals = config.decimals !== undefined ? Number(config.decimals) : 2
  return (
    <div className="mt-3 space-y-2">
      <div>
        <label className="text-xs text-slate-500 mb-1 block">Поле-источник (сумма для конвертации)</label>
        <select
          className="text-xs border border-slate-200 rounded px-2 py-1.5 w-full bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
          value={String(config.source_field ?? '')}
          onChange={(e) => onChange({ ...config, source_field: e.target.value })}
        >
          <option value="">— выберите поле —</option>
          {sourceFields.map((f) => (
            <option key={f._id} value={f.slug}>{f.name}</option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-xs text-slate-500 mb-1 block">Из валюты</label>
          <select
            className="text-xs border border-slate-200 rounded px-2 py-1.5 w-full bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
            value={String(config.from ?? 'usd')}
            onChange={(e) => onChange({ ...config, from: e.target.value })}
          >
            {CURRENCY_CODES.map((c) => <option key={c} value={c}>{c.toUpperCase()}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-500 mb-1 block">В валюту</label>
          <select
            className="text-xs border border-slate-200 rounded px-2 py-1.5 w-full bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
            value={String(config.to ?? 'uzs')}
            onChange={(e) => onChange({ ...config, to: e.target.value })}
          >
            {CURRENCY_CODES.map((c) => <option key={c} value={c}>{c.toUpperCase()}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-500 mb-1 block">Знаков после запятой</label>
          <input type="number" min="0" max="4"
            className="text-xs border border-slate-200 rounded px-2 py-1.5 w-full bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
            value={String(decimals)}
            onChange={(e) => onChange({ ...config, decimals: e.target.value === '' ? 2 : Number(e.target.value) })} />
        </div>
      </div>
      <p className="text-xs text-slate-400">
        Курс обновляется в реальном времени. Значение пересчитывается при каждом сохранении записи.
      </p>
    </div>
  )
}

// ─── STATUS Config Editor ─────────────────────────────────────────────────────
interface StatusOption { value: string; label: string; color: string }
function StatusOptionsEditor({ options, onChange }: {
  options: StatusOption[]
  onChange: (o: StatusOption[]) => void
}) {
  const PRESET_COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#64748b', '#06b6d4', '#f97316']
  const add = () => {
    const n = options.length + 1
    onChange([...options, { value: `status_${n}`, label: `Статус ${n}`, color: PRESET_COLORS[n % PRESET_COLORS.length] }])
  }
  const remove = (i: number) => onChange(options.filter((_, idx) => idx !== i))
  const update = (i: number, k: keyof StatusOption, v: string) =>
    onChange(options.map((o, idx) => idx === i ? { ...o, [k]: v } : o))
  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Варианты статуса</span>
        <button type="button" onClick={add}
          className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 font-medium">
          <Plus size={12} /> Добавить
        </button>
      </div>
      <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
        {options.map((opt, i) => (
          <div key={i} className="flex items-center gap-2 bg-slate-50 rounded-lg px-2 py-1.5">
            <input type="color" value={opt.color}
              onChange={(e) => update(i, 'color', e.target.value)}
              className="w-6 h-6 rounded cursor-pointer border-0 p-0 shrink-0" />
            <div className="flex-1 grid grid-cols-2 gap-2">
              <input
                className="text-xs border border-slate-200 rounded px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 font-mono"
                placeholder="значение (id)"
                value={opt.value}
                onChange={(e) => update(i, 'value', e.target.value.replace(/\s+/g, '_').toLowerCase())} />
              <input
                className="text-xs border border-slate-200 rounded px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
                placeholder="отображение"
                value={opt.label}
                onChange={(e) => update(i, 'label', e.target.value)} />
            </div>
            <button type="button" onClick={() => remove(i)}
              className="text-slate-300 hover:text-red-500 transition-colors shrink-0">
              <X size={13} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── WAREHOUSE LOCATION Config Editor ────────────────────────────────────────
function WarehouseConfigEditor({ config, onChange }: {
  config: Record<string, unknown>
  onChange: (c: Record<string, unknown>) => void
}) {
  return (
    <div className="mt-3 space-y-2">
      <div>
        <label className="text-xs text-slate-500 mb-1 block">Формат / подсказка</label>
        <input className="text-xs border border-slate-200 rounded px-2 py-1.5 w-full bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 font-mono"
          placeholder="А-12-3"
          value={String(config.placeholder ?? 'А-12-3')}
          onChange={(e) => onChange({ ...config, placeholder: e.target.value })} />
        <p className="text-xs text-slate-400 mt-0.5">Например: Склад-Стеллаж-Полка-Ячейка → А-12-3-5</p>
      </div>
    </div>
  )
}

const FIELDS_WITH_CONFIG = new Set([
  'select', 'number', 'expiry_date', 'quantity_unit', 'relation',
  'price', 'autoincrement', 'formula', 'status', 'warehouse_location', 'currency_convert',
])

// ─── Sortable Field Row ─────────────────────────────────────────────────────
function SortableField({ field, updateField, removeField, toggleExpand, currentEntityId, allFields }: {
  field: FieldDraft
  updateField: (id: string, p: Partial<FieldDraft>) => void
  removeField: (id: string) => void
  toggleExpand: (id: string) => void
  currentEntityId?: string
  allFields: FieldDraft[]
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: field._id })

  const style = { transform: CSS.Transform.toString(transform), transition,
    zIndex: isDragging ? 50 : undefined, opacity: isDragging ? 0.5 : 1 }

  const ft = FIELD_TYPES.find((t) => t.type === field.field_type)
  const options: SelectOption[] = (field.config as any)?.options ?? []
  const numConfig: Record<string, unknown> = (field.config as any) ?? {}
  const hasConfig = FIELDS_WITH_CONFIG.has(field.field_type)

  const typeColor = FIELD_TYPE_COLORS[field.field_type] ?? '#6366f1'

  return (
    <div ref={setNodeRef} style={style}
      className={`rounded-xl overflow-hidden ${isDragging ? 'shadow-xl ring-2 ring-brand-200' : 'border border-slate-200 shadow-sm'}`}>
      <div className="flex bg-white">
        {/* Left color strip */}
        <div className="w-1.5 shrink-0" style={{ background: typeColor }} />
        <div className="flex-1 min-w-0">
          {/* Main row */}
          <div className="p-4 flex items-start gap-3">
            <div {...attributes} {...listeners}
              className="mt-2 text-slate-300 cursor-grab active:cursor-grabbing hover:text-slate-500 shrink-0">
              <GripVertical size={15} />
            </div>

            <div className="flex-1 grid grid-cols-2 gap-3">
              {/* Name */}
              <Input label="Название поля" value={field.name}
                onChange={(e) => updateField(field._id, { name: e.target.value, slug: slugifyField(e.target.value) })} />
              {/* Type badge */}
              <div>
                <label className="label">Тип</label>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-xl">{ft?.icon}</span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold text-white"
                    style={{ background: typeColor }}>
                    {ft?.label}
                  </span>
                </div>
              </div>
              {/* Slug */}
              <div className="col-span-2">
                <label className="label">Slug (ключ)</label>
                <input className="input text-xs font-mono text-slate-500" value={field.slug}
                  onChange={(e) => updateField(field._id, { slug: slugifyField(e.target.value) })} />
              </div>
              {/* Checkboxes */}
              <div className="col-span-2 flex items-center gap-6 flex-wrap">
                <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
                  <input type="checkbox" checked={field.is_required}
                    onChange={(e) => updateField(field._id, { is_required: e.target.checked })}
                    className="accent-brand-600 w-3.5 h-3.5" />
                  Обязательное поле
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
                  <input type="checkbox" checked={field.is_searchable}
                    onChange={(e) => updateField(field._id, { is_searchable: e.target.checked })}
                    className="accent-brand-600 w-3.5 h-3.5" />
                  Участвует в поиске
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-600 select-none">
                  Ширина в форме
                  <select
                    className="text-xs border border-slate-200 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
                    value={String((field.config as any)?.width ?? 'full')}
                    onChange={(e) => updateField(field._id, { config: { ...field.config, width: e.target.value } })}
                  >
                    <option value="full">Полная</option>
                    <option value="half">Половина</option>
                    <option value="third">Треть</option>
                  </select>
                </label>
              </div>
            </div>

            <div className="flex flex-col gap-1 shrink-0 mt-1">
              {hasConfig && (
                <button type="button" onClick={() => toggleExpand(field._id)}
                  className={`p-1.5 rounded-lg transition-colors ${field._expanded
                    ? 'text-brand-600 bg-brand-50'
                    : 'text-slate-400 hover:text-brand-600 hover:bg-brand-50'}`}
                  title={field._expanded ? 'Скрыть настройки' : 'Настройки'}>
                  {field._expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
              )}
              <button type="button" onClick={() => removeField(field._id)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                title="Удалить поле">
                <Trash2 size={14} />
              </button>
            </div>
          </div>

          {/* Config panel */}
          {field._expanded && hasConfig && (
            <div className="px-12 pb-4 pt-1 bg-gradient-to-b from-slate-50 to-white border-t border-slate-100">
              {field.field_type === 'select' && (
                <SelectOptionsEditor options={options}
                  onChange={(opts) => updateField(field._id, { config: { ...field.config, options: opts } })} />
              )}
              {field.field_type === 'number' && (
                <NumberConfigEditor config={numConfig}
                  onChange={(c) => updateField(field._id, { config: c })} />
              )}
              {field.field_type === 'expiry_date' && (
                <ExpiryConfigEditor config={numConfig}
                  onChange={(c) => updateField(field._id, { config: c })} />
              )}
              {field.field_type === 'quantity_unit' && (
                <QuantityUnitConfigEditor config={numConfig}
                  onChange={(c) => updateField(field._id, { config: c })} />
              )}
              {field.field_type === 'relation' && (
                <RelationConfigEditor config={numConfig} currentEntityId={currentEntityId}
                  onChange={(c) => updateField(field._id, { config: c })} />
              )}
              {field.field_type === 'price' && (
                <PriceConfigEditor config={numConfig}
                  onChange={(c) => updateField(field._id, { config: c })} />
              )}
              {field.field_type === 'autoincrement' && (
                <AutoincrementConfigEditor config={numConfig}
                  onChange={(c) => updateField(field._id, { config: c })} />
              )}
              {field.field_type === 'formula' && (
                <FormulaConfigEditor config={numConfig} fields={allFields.filter((f) => f._id !== field._id)}
                  onChange={(c) => updateField(field._id, { config: c })} />
              )}
              {field.field_type === 'currency_convert' && (
                <CurrencyConvertConfigEditor config={numConfig} fields={allFields.filter((f) => f._id !== field._id)}
                  onChange={(c) => updateField(field._id, { config: c })} />
              )}
              {field.field_type === 'status' && (
                <StatusOptionsEditor options={(field.config as any)?.options ?? []}
                  onChange={(opts) => updateField(field._id, { config: { ...field.config, options: opts } })} />
              )}
              {field.field_type === 'warehouse_location' && (
                <WarehouseConfigEditor config={numConfig}
                  onChange={(c) => updateField(field._id, { config: c })} />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ──────────────────────────────────────────────────────────────
export default function EntityBuilderPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const isEdit = !!id

  const { data: existing, isLoading } = useEntity(id ?? '')
  const createEntity = useCreateEntity()
  const updateEntity = useUpdateEntity()

  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [description, setDescription] = useState('')
  const [icon, setIcon] = useState('📋')
  const [color, setColor] = useState('#6366f1')
  const [fields, setFields] = useState<FieldDraft[]>([])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  useEffect(() => {
    if (!existing) return
    setName(existing.name)
    setSlug(existing.slug)
    setDescription(existing.description ?? '')
    setIcon(existing.icon ?? '📋')
    setColor(existing.color ?? '#6366f1')
    setFields(
      [...existing.fields]
        .sort((a, b) => a.position - b.position)
        .map((f) => ({
          _id: f.id,
          name: f.name,
          slug: f.slug,
          field_type: f.field_type,
          is_required: f.is_required,
          is_searchable: f.is_searchable,
          position: f.position,
          config: f.config ?? undefined,
          _expanded: ['select', 'number', 'price', 'autoincrement', 'formula', 'status', 'warehouse_location'].includes(f.field_type),
        }))
    )
  }, [existing])

  const DEFAULT_CONFIGS: Partial<Record<FieldType, Record<string, unknown>>> = {
    select:             { options: [{ value: 'option_1', label: 'Вариант 1' }] },
    number:             {},
    expiry_date:        { warn_days: 30 },
    quantity_unit:      { default_unit: 'шт', units: ['шт', 'кг', 'л', 'м', 'м²', 'м³'] },
    relation:           {},
    price:              { currency: 'UZS', symbol: 'сум', decimals: 0 },
    autoincrement:      { prefix: '', next_value: 1, padding: 6 },
    formula:            { formula: '' },
    status:             { options: [{ value: 'active', label: 'Активный', color: '#22c55e' }, { value: 'inactive', label: 'Неактивный', color: '#64748b' }] },
    warehouse_location: { placeholder: 'А-12-3' },
  }

  const addField = (type: FieldType) => {
    const label = FIELD_TYPES.find((t) => t.type === type)?.label ?? type
    const n = fields.length + 1
    setFields((prev) => [...prev, {
      _id: Math.random().toString(36).slice(2, 9),
      name: `${label} ${n}`,
      slug: slugifyField(`${label}_${n}`),
      field_type: type,
      is_required: false,
      is_searchable: true,
      position: prev.length,
      config: DEFAULT_CONFIGS[type],
      _expanded: FIELDS_WITH_CONFIG.has(type),
    }])
  }

  const removeField   = (id: string) => setFields((f) => f.filter((x) => x._id !== id))
  const updateField   = (id: string, p: Partial<FieldDraft>) => setFields((f) => f.map((x) => x._id === id ? { ...x, ...p } : x))
  const toggleExpand  = (id: string) => setFields((f) => f.map((x) => x._id === id ? { ...x, _expanded: !x._expanded } : x))

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (over && active.id !== over.id) {
      setFields((items) => arrayMove(items, items.findIndex((i) => i._id === active.id), items.findIndex((i) => i._id === over.id)))
    }
  }

  const handleSave = () => {
    if (!name.trim()) return toast.error('Укажите название сущности')
    if (!slug.trim()) return toast.error('Укажите slug')

    for (const f of fields) {
      if (!f.name.trim()) return toast.error('Заполните названия всех полей')
      if (!f.slug.trim()) return toast.error(`Поле "${f.name}": slug не может быть пустым`)
      if (f.field_type === 'select') {
        const opts = (f.config as any)?.options ?? []
        if (opts.length === 0) return toast.error(`Поле "${f.name}": добавьте хотя бы один вариант списка`)
        if (opts.some((o: SelectOption) => !o.value.trim())) return toast.error(`Поле "${f.name}": значение варианта не может быть пустым`)
      }
    }

    const payload = {
      name, slug,
      description: description || undefined,
      icon, color,
      fields: fields.map((f, i) => ({
        name: f.name, slug: f.slug,
        field_type: f.field_type,
        is_required: f.is_required,
        is_searchable: f.is_searchable,
        position: i,
        config: f.config,
      })),
    }

    if (isEdit) {
      updateEntity.mutate({ id: id!, data: payload }, { onSuccess: () => navigate('/entities') })
    } else {
      createEntity.mutate(payload, { onSuccess: () => navigate('/entities') })
    }
  }

  if (isEdit && isLoading)
    return <div className="flex justify-center py-16"><Spinner /></div>

  const isSaving = createEntity.isPending || updateEntity.isPending

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/entities')} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-xl font-semibold text-slate-900">
            {isEdit ? 'Редактировать сущность' : 'Создать сущность'}
          </h1>
        </div>
        <Button icon={<Save size={16} />} onClick={handleSave} loading={isSaving}>
          {isEdit ? 'Сохранить изменения' : 'Создать'}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_200px_1fr] gap-5 items-start">
        {/* Col 1 — basic info */}
        <Card>
          <CardHeader><p className="text-sm font-semibold text-slate-900">Основное</p></CardHeader>
          <CardBody className="space-y-4">
            <Input label="Название" value={name} required placeholder="Клиенты"
              onChange={(e) => { setName(e.target.value); if (!isEdit) setSlug(slugifyEntity(e.target.value)) }} />
            <Input label="Slug" value={slug} placeholder="klienty" hint="Уникальный URL-идентификатор"
              onChange={(e) => setSlug(slugifyEntity(e.target.value))} />
            <Input label="Описание" value={description} placeholder="Краткое описание..."
              onChange={(e) => setDescription(e.target.value)} />
            <div>
              <label className="label">Иконка</label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {ICONS.map((ic) => (
                  <button key={ic} type="button" onClick={() => setIcon(ic)}
                    className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center transition-all border ${
                      icon === ic ? 'ring-2 ring-brand-500 bg-brand-50 border-brand-300 scale-110' : 'border-slate-200 hover:bg-slate-50'}`}>
                    {ic}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="label">Цвет</label>
              <div className="flex gap-2 flex-wrap mt-1">
                {COLORS.map((c) => (
                  <button key={c} type="button" onClick={() => setColor(c)}
                    className={`w-7 h-7 rounded-lg border-2 transition-all ${color === c ? 'border-slate-800 scale-110 shadow-md' : 'border-transparent hover:scale-105'}`}
                    style={{ background: c }} />
                ))}
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Col 2 — field type picker */}
        <Card>
          <CardHeader><p className="text-sm font-semibold text-slate-900">Добавить поле</p></CardHeader>
          <div className="p-2 space-y-0.5">
            {FIELD_TYPES.map((ft) => (
              <button key={ft.type} type="button" onClick={() => addField(ft.type)}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg border border-transparent hover:border-brand-200 hover:bg-brand-50 transition-colors text-left group">
                <span className="text-base shrink-0">{ft.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-700 group-hover:text-brand-700 leading-tight">{ft.label}</p>
                  <p className="text-xs text-slate-400 truncate leading-tight">{ft.desc}</p>
                </div>
                <Plus size={11} className="text-slate-300 group-hover:text-brand-500 shrink-0" />
              </button>
            ))}
          </div>
        </Card>

        {/* Col 3 — fields list */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-900">
                Поля <span className="text-slate-400 font-normal ml-1">({fields.length})</span>
              </p>
              {fields.length > 0 && (
                <p className="text-xs text-slate-400">Перетаскивайте чтобы изменить порядок</p>
              )}
            </div>
          </CardHeader>

          {fields.length === 0 ? (
            <div className="py-12 text-center">
              <div className="text-4xl mb-2 opacity-30">🏗️</div>
              <p className="text-sm font-medium text-slate-500">Нет полей</p>
              <p className="text-xs text-slate-400 mt-1">Нажмите на тип поля слева чтобы добавить</p>
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={fields.map((f) => f._id)} strategy={verticalListSortingStrategy}>
                <div className="p-3 space-y-2">
                  {fields.map((field) => (
                    <SortableField key={field._id} field={field}
                      updateField={updateField} removeField={removeField}
                      toggleExpand={toggleExpand} currentEntityId={id}
                      allFields={fields} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </Card>
      </div>
    </div>
  )
}
