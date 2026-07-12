import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Save, Package, Upload, X, FileText } from 'lucide-react'
import { useEntity, useCreateRecord, useUpdateRecord } from '@/hooks/useEntities'
import { entitiesApi } from '@/api/entities'
import { useQuery } from '@tanstack/react-query'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Card, { CardBody, CardHeader } from '@/components/ui/Card'
import Spinner from '@/components/ui/Spinner'
import MovementPanel from '@/components/movements/MovementPanel'
import toast from 'react-hot-toast'
import type { EntityField } from '@/types/entity'

// ─── Live formula evaluation (mirrors backend _eval_formula) ────────────────
// ponytail: regex-restricted char set only, no live re-implementation of the eval sandbox subtleties
function evalFormula(
  expr: string,
  data: Record<string, unknown>,
  rates: Record<string, number> = {}
): number | null {
  if (!expr || /[^0-9a-zа-яё_\s+\-*/.()]/i.test(expr)) return null
  const ctx: Record<string, number> = {}
  for (const [slug, value] of Object.entries(data)) {
    if (typeof value === 'number') ctx[slug] = value
    else if (value && typeof value === 'object' && 'value' in (value as any)) {
      const n = Number((value as any).value)
      ctx[slug] = Number.isFinite(n) ? n : 0
    } else if (typeof value === 'string' && value.trim() !== '') {
      const n = Number(value)
      ctx[slug] = Number.isFinite(n) ? n : 0
    } else {
      ctx[slug] = 0
    }
  }
  // rate_<code> = units of <code> per 1 USD (e.g. rate_uzs ≈ 12650)
  for (const [code, rate] of Object.entries(rates)) {
    ctx[`rate_${code.toLowerCase()}`] = rate
  }
  const tokens = expr.match(/[a-zа-яё_][a-zа-яё0-9_]*/gi) ?? []
  if (tokens.some((t) => !(t in ctx))) return null
  const jsExpr = expr.replace(/[a-zа-яё_][a-zа-яё0-9_]*/gi, (t) => String(ctx[t]))
  try {
    // safe: jsExpr only contains digits/operators/whitespace after identifier substitution above
    const val = Function(`"use strict"; return (${jsExpr});`)()
    return typeof val === 'number' && Number.isFinite(val) ? Math.round(val * 1e10) / 1e10 : null
  } catch {
    return null
  }
}

// ─── Live currency conversion (mirrors backend _convert_currency) ───────────
function convertCurrency(
  config: Record<string, unknown>,
  data: Record<string, unknown>,
  rates: Record<string, number> = {}
): number | null {
  const sourceSlug = String(config.source_field ?? '')
  const raw = data[sourceSlug]
  const amount = typeof raw === 'object' && raw !== null && 'value' in (raw as any)
    ? Number((raw as any).value)
    : Number(raw)
  if (!Number.isFinite(amount)) return null
  const from = String(config.from ?? 'usd').toUpperCase()
  const to = String(config.to ?? 'usd').toUpperCase()
  const rateFrom = from === 'USD' ? 1 : rates[from]
  const rateTo = to === 'USD' ? 1 : rates[to]
  if (!rateFrom || !rateTo) return null
  const decimals = config.decimals !== undefined ? Number(config.decimals) : 2
  return Math.round((amount / rateFrom) * rateTo * 10 ** decimals) / 10 ** decimals
}

// ─── QR display (install qrcode.react if needed) ────────────────────────────
function BarcodeDisplay({ value }: { value: string }) {
  const copy = () => { navigator.clipboard.writeText(value); toast.success('Скопировано') }
  return (
    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
      <code className="flex-1 font-mono text-sm text-slate-800 break-all">{value || '—'}</code>
      {value && (
        <button onClick={copy} className="text-xs text-brand-600 hover:underline shrink-0">
          Копировать
        </button>
      )}
    </div>
  )
}

// ─── RelationPicker ──────────────────────────────────────────────────────────
function RelationPicker({
  field,
  value,
  onChange,
}: {
  field: EntityField
  value: unknown
  onChange: (v: unknown) => void
}) {
  const relEntityId = (field.config as any)?.entity_id as string | undefined
  const displayField = (field.config as any)?.display_field as string | undefined
  const navigate = useNavigate()

  const { data: records } = useQuery({
    queryKey: ['records', relEntityId],
    queryFn: () => entitiesApi.listRecords(relEntityId!, { size: 200 }),
    enabled: !!relEntityId,
  })

  const selectedRecord = records?.items.find((r) => r.id === String(value ?? ''))
  const selectedLabel = selectedRecord
    ? displayField
      ? String(selectedRecord.data[displayField] ?? '—')
      : `#${String(value).slice(0, 8)}`
    : null

  return (
    <div>
      <label className="label">
        {field.name}
        {field.is_required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <div className="flex gap-2">
        <select
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value || null)}
          className="input flex-1"
        >
          <option value="">— выберите —</option>
          {records?.items.map((r) => {
            const label = displayField
              ? String(r.data[displayField] ?? r.id.slice(0, 8))
              : r.id.slice(0, 8)
            return (
              <option key={r.id} value={r.id}>
                {label}
              </option>
            )
          })}
        </select>
        {!!value && relEntityId && (
          <button
            type="button"
            onClick={() =>
              navigate(`/entities/${relEntityId}/records`, {
                state: { highlightId: String(value) },
              })
            }
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-violet-200 bg-violet-50 text-violet-600 hover:bg-violet-100 transition-colors text-sm shrink-0"
            title="Открыть связанную запись">
            🔗 Открыть
          </button>
        )}
      </div>
      {selectedLabel && (
        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-violet-600">
          <span>✓ Выбрано:</span>
          <span className="font-semibold">{selectedLabel}</span>
        </p>
      )}
    </div>
  )
}

// ─── ImageUploader ───────────────────────────────────────────────────────────
function ImageUploader({ field, value, onChange }: {
  field: EntityField; value: unknown; onChange: (v: unknown) => void
}) {
  const imgRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const handleUpload = async (file: File) => {
    setUploading(true)
    try {
      const result = await entitiesApi.uploadImage(file)
      onChange(result.url)
    } catch {
      toast.error('Ошибка загрузки изображения')
    } finally {
      setUploading(false)
    }
  }
  const handlePaste = (e: React.ClipboardEvent) => {
    const item = Array.from(e.clipboardData.items).find((i) => i.type.startsWith('image/'))
    const file = item?.getAsFile()
    if (file) handleUpload(file)
  }
  return (
    <div>
      <label className="label">
        {field.name}
        {field.is_required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <div className="space-y-2" onPaste={handlePaste} tabIndex={0}>
        {value ? (
          <div className="relative inline-block">
            <img src={String(value)} alt={field.name}
              className="h-32 w-32 object-cover rounded-xl border border-slate-200" />
            <button type="button" onClick={() => onChange('')}
              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600">
              <X size={12} />
            </button>
          </div>
        ) : (
          <div onClick={() => imgRef.current?.click()}
            className="flex flex-col items-center justify-center w-32 h-32 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:border-brand-400 hover:bg-brand-50 transition-colors">
            {uploading ? <Spinner size="sm" /> : (
              <>
                <Upload size={20} className="text-slate-400 mb-1" />
                <span className="text-xs text-slate-400 text-center px-1">Загрузить фото<br />или Ctrl+V</span>
              </>
            )}
          </div>
        )}
        <input ref={imgRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f) }} />
      </div>
    </div>
  )
}

// ─── FileUploader ─────────────────────────────────────────────────────────────
function FileUploader({ field, value, onChange }: {
  field: EntityField; value: unknown; onChange: (v: unknown) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const fileUrl = String(value ?? '')
  const fileName = fileUrl ? decodeURIComponent(fileUrl.split('/').pop() ?? 'файл') : ''
  const handleUpload = async (file: File) => {
    setUploading(true)
    try {
      const result = await entitiesApi.uploadFile(file)
      onChange(result.url)
      toast.success(`Файл загружен: ${result.original_name}`)
    } catch {
      toast.error('Ошибка загрузки файла')
    } finally {
      setUploading(false)
    }
  }
  return (
    <div>
      <label className="label">
        {field.name}
        {field.is_required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {fileUrl ? (
        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
          <FileText size={16} className="text-slate-400 shrink-0" />
          <a href={fileUrl} download={fileName}
            className="flex-1 text-sm text-brand-600 hover:underline truncate">{fileName}</a>
          <button type="button" onClick={() => onChange('')}
            className="text-slate-400 hover:text-red-500 shrink-0"><X size={14} /></button>
        </div>
      ) : (
        <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
          className="flex items-center gap-2 px-4 py-2.5 border-2 border-dashed border-slate-300 rounded-xl text-sm text-slate-500 hover:border-brand-400 hover:text-brand-600 hover:bg-brand-50 transition-colors disabled:opacity-50">
          {uploading ? <Spinner size="sm" /> : <Upload size={14} />}
          Прикрепить файл (PDF, Word, Excel...)
        </button>
      )}
      <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,image/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f) }} />
    </div>
  )
}

// ─── FieldInput ──────────────────────────────────────────────────────────────
function FieldInput({
  field,
  value,
  onChange,
}: {
  field: EntityField
  value: unknown
  onChange: (v: unknown) => void
}) {
  switch (field.field_type) {
    case 'boolean':
      return (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={!!value}
            onChange={(e) => onChange(e.target.checked)}
            className="w-4 h-4 accent-brand-600"
          />
          <span className="text-sm text-slate-700">{field.name}</span>
          {field.is_required && <span className="text-red-500 text-xs">*</span>}
        </label>
      )

    case 'select': {
      const options = (field.config as any)?.options ?? []
      return (
        <div>
          <label className="label">
            {field.name}
            {field.is_required && <span className="text-red-500 ml-0.5">*</span>}
          </label>
          <select
            value={String(value ?? '')}
            onChange={(e) => onChange(e.target.value)}
            className="input"
          >
            <option value="">— выберите —</option>
            {options.map((opt: any) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      )
    }

    case 'date':
      return (
        <Input
          label={field.name}
          type="date"
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          required={field.is_required}
        />
      )

    case 'expiry_date': {
      const warnDays = (field.config as any)?.warn_days ?? 30
      const val = String(value ?? '')
      const isExpired = val && new Date(val) < new Date()
      const daysLeft = val
        ? Math.ceil((new Date(val).getTime() - Date.now()) / 86400000)
        : null
      return (
        <div>
          <Input
            label={`${field.name} (срок годности, уведомление за ${warnDays} дн.)`}
            type="date"
            value={val}
            onChange={(e) => onChange(e.target.value)}
            required={field.is_required}
          />
          {val && daysLeft !== null && (
            <p className={`text-xs mt-1 ${isExpired ? 'text-red-500' : daysLeft <= warnDays ? 'text-amber-600' : 'text-slate-400'}`}>
              {isExpired
                ? `⛔ Просрочено (${Math.abs(daysLeft)} дн. назад)`
                : daysLeft === 0
                ? '🔴 Истекает сегодня'
                : daysLeft <= warnDays
                ? `⚠️ Осталось ${daysLeft} дн.`
                : `✅ Осталось ${daysLeft} дн.`}
            </p>
          )}
        </div>
      )
    }

    case 'number':
      return (
        <Input
          label={field.name}
          type="number"
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
          required={field.is_required}
        />
      )

    case 'quantity_unit': {
      const qty = (value as any)?.value ?? ''
      const unit = (value as any)?.unit ?? ((field.config as any)?.default_unit ?? '')
      const availableUnits: string[] = (field.config as any)?.units ?? ['шт', 'кг', 'л', 'м', 'м²', 'м³']
      return (
        <div>
          <label className="label">
            {field.name}
            {field.is_required && <span className="text-red-500 ml-0.5">*</span>}
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              step="any"
              className="input flex-1"
              placeholder="0"
              value={qty}
              onChange={(e) =>
                onChange({ value: e.target.value === '' ? '' : Number(e.target.value), unit })
              }
            />
            <select
              className="input w-28"
              value={unit}
              onChange={(e) => onChange({ value: qty, unit: e.target.value })}
            >
              {availableUnits.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
              <option value={unit}>{unit}</option>
            </select>
          </div>
        </div>
      )
    }

    case 'barcode':
      return (
        <div>
          <label className="label">
            {field.name}
            {field.is_required && <span className="text-red-500 ml-0.5">*</span>}
          </label>
          <div className="space-y-2">
            <input
              className="input font-mono"
              placeholder="Введите или отсканируйте штрихкод..."
              value={String(value ?? '')}
              onChange={(e) => onChange(e.target.value)}
            />
            {!!value && <BarcodeDisplay value={String(value)} />}
          </div>
        </div>
      )

    case 'relation':
      return <RelationPicker field={field} value={value} onChange={onChange} />

    case 'price': {
      const currency = (field.config as any)?.currency ?? 'UZS'
      const symbol = (field.config as any)?.symbol ?? 'сум'
      const decimals = (field.config as any)?.decimals ?? 2
      return (
        <div>
          <label className="label">
            {field.name}
            {field.is_required && <span className="text-red-500 ml-0.5">*</span>}
          </label>
          <div className="flex items-center gap-0">
            <span className="inline-flex items-center px-3 h-10 bg-slate-100 border border-r-0 border-slate-200 rounded-l-xl text-sm text-slate-500 shrink-0">
              {symbol}
            </span>
            <input
              type="number"
              step={decimals > 0 ? `0.${'0'.repeat(decimals - 1)}1` : '1'}
              min="0"
              className="input rounded-l-none flex-1"
              placeholder="0"
              value={String(value ?? '')}
              onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
            />
            <span className="inline-flex items-center px-3 h-10 bg-slate-100 border border-l-0 border-slate-200 rounded-r-xl text-sm text-slate-400 shrink-0">
              {currency}
            </span>
          </div>
        </div>
      )
    }

    case 'autoincrement':
      return (
        <div>
          <label className="label">
            {field.name}
            <span className="ml-2 text-xs text-slate-400 font-normal">(генерируется автоматически)</span>
          </label>
          <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-xs text-slate-400">🔖</span>
            <span className="text-sm text-slate-500 italic">
              {value ? String(value) : 'Будет назначен при создании'}
            </span>
          </div>
        </div>
      )

    case 'formula':
      return (
        <div>
          <label className="label">
            {field.name}
            <span className="ml-2 text-xs text-slate-400 font-normal">(вычисляется автоматически)</span>
          </label>
          <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-xl border border-blue-200">
            <span className="text-xs text-blue-400">🧮</span>
            <span className="text-sm font-medium text-blue-700">
              {value !== null && value !== undefined && value !== '' ? String(value) : '—'}
            </span>
          </div>
        </div>
      )

    case 'currency_convert': {
      const decimals = (field.config as any)?.decimals ?? 2
      const to = String((field.config as any)?.to ?? '').toUpperCase()
      const num = typeof value === 'number' ? value : parseFloat(String(value))
      return (
        <div>
          <label className="label">
            {field.name}
            <span className="ml-2 text-xs text-slate-400 font-normal">(конвертируется автоматически)</span>
          </label>
          <div className="flex items-center gap-2 p-3 bg-emerald-50 rounded-xl border border-emerald-200">
            <span className="text-xs text-emerald-500">💱</span>
            <span className="text-sm font-medium text-emerald-700">
              {Number.isFinite(num)
                ? `${num.toLocaleString('ru-RU', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} ${to}`
                : '—'}
            </span>
          </div>
        </div>
      )
    }

    case 'warehouse_location': {
      const placeholder = (field.config as any)?.placeholder ?? 'А-12-3'
      return (
        <div>
          <label className="label">
            {field.name}
            {field.is_required && <span className="text-red-500 ml-0.5">*</span>}
          </label>
          <div className="flex items-center gap-0">
            <span className="inline-flex items-center px-3 h-10 bg-slate-100 border border-r-0 border-slate-200 rounded-l-xl text-base shrink-0">
              📍
            </span>
            <input
              className="input rounded-l-none flex-1 font-mono"
              placeholder={placeholder}
              value={String(value ?? '')}
              onChange={(e) => onChange(e.target.value)}
            />
          </div>
        </div>
      )
    }

    case 'status': {
      const options = (field.config as any)?.options ?? []
      return (
        <div>
          <label className="label">
            {field.name}
            {field.is_required && <span className="text-red-500 ml-0.5">*</span>}
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onChange('')}
              className={`px-3 py-1.5 rounded-lg text-sm border transition-all ${
                !value ? 'bg-slate-100 border-slate-300 text-slate-600' : 'border-transparent text-slate-400 hover:bg-slate-50'
              }`}
            >
              — не выбрано
            </button>
            {options.map((opt: any) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onChange(opt.value)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border-2 transition-all ${
                  value === opt.value ? 'ring-2 ring-offset-1' : 'opacity-70 hover:opacity-100'
                }`}
                style={{
                  backgroundColor: value === opt.value ? opt.color + '22' : 'transparent',
                  borderColor: opt.color,
                  color: opt.color,
                  ['--tw-ring-color' as string]: opt.color,
                }}
              >
                ● {opt.label}
              </button>
            ))}
          </div>
        </div>
      )
    }

    case 'image':
      return <ImageUploader field={field} value={value} onChange={onChange} />

    case 'file':
      return <FileUploader field={field} value={value} onChange={onChange} />

    case 'url':
      return (
        <div>
          <label className="label">
            {field.name}
            {field.is_required && <span className="text-red-500 ml-0.5">*</span>}
          </label>
          <div className="flex items-center gap-0">
            <span className="inline-flex items-center px-3 h-10 bg-slate-100 border border-r-0 border-slate-200 rounded-l-xl text-base shrink-0">
              🌐
            </span>
            <input
              type="url"
              className="input rounded-l-none flex-1"
              placeholder="https://example.com"
              value={String(value ?? '')}
              onChange={(e) => onChange(e.target.value)}
            />
          </div>
        </div>
      )

    default:
      return (
        <Input
          label={field.name}
          type={field.field_type === 'email' ? 'email' : field.field_type === 'phone' ? 'tel' : 'text'}
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          required={field.is_required}
          placeholder={`Введите ${field.name.toLowerCase()}...`}
        />
      )
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────
export default function RecordFormPage() {
  const { entityId, recordId } = useParams<{ entityId: string; recordId?: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const backUrl: string = (location.state as any)?.backUrl ?? `/entities/${entityId}/records`
  const isEdit = !!recordId

  const { data: entity, isLoading: entityLoading } = useEntity(entityId!)
  const { data: existingRecord } = useQuery({
    queryKey: ['record', entityId, recordId],
    queryFn: () => entitiesApi.getRecord(entityId!, recordId!),
    enabled: isEdit,
  })

  const [formData, setFormData] = useState<Record<string, unknown>>({})
  const [activeTab, setActiveTab] = useState<'fields' | 'movements'>('fields')
  const createRecord = useCreateRecord()
  const updateRecord = useUpdateRecord()

  const hasFormulaField = entity?.fields.some(
    (f) => f.field_type === 'formula' || f.field_type === 'currency_convert'
  ) ?? false
  const { data: exchangeRates } = useQuery({
    queryKey: ['exchange-rates'],
    queryFn: () => entitiesApi.getExchangeRates(),
    enabled: hasFormulaField,
    staleTime: 60 * 60 * 1000, // 1h — matches backend cache TTL
    refetchInterval: 60 * 60 * 1000,
  })

  useEffect(() => {
    if (existingRecord) setFormData(existingRecord.data)
  }, [existingRecord])

  // Recompute formula fields live as their source fields change (e.g. currency conversion)
  useEffect(() => {
    const formulaFields = entity?.fields.filter((f) => f.field_type === 'formula') ?? []
    if (formulaFields.length === 0) return
    setFormData((prev) => {
      let changed = false
      const next = { ...prev }
      for (const field of formulaFields) {
        const config = (field.config as any) ?? {}
        const expr = String(config.formula ?? '').trim()
        if (!expr) continue
        const val = evalFormula(expr, prev, exchangeRates?.rates)
        const prefix = String(config.prefix ?? '')
        const suffix = String(config.suffix ?? '')
        const display =
          val === null ? null : prefix || suffix ? `${prefix}${val}${suffix}` : val
        if (next[field.slug] !== display) {
          next[field.slug] = display
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [formData, entity, exchangeRates])

  // Recompute currency_convert fields live as their source field changes
  useEffect(() => {
    const currencyFields = entity?.fields.filter((f) => f.field_type === 'currency_convert') ?? []
    if (currencyFields.length === 0) return
    setFormData((prev) => {
      let changed = false
      const next = { ...prev }
      for (const field of currencyFields) {
        const config = (field.config as any) ?? {}
        const val = convertCurrency(config, prev, exchangeRates?.rates)
        if (next[field.slug] !== val) {
          next[field.slug] = val
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [formData, entity, exchangeRates])

  const setField = (slug: string, value: unknown) =>
    setFormData((prev) => ({ ...prev, [slug]: value }))

  const handleSubmit = () => {
    const missing = entity?.fields.filter(
      (f) => f.is_required && (formData[f.slug] === undefined || formData[f.slug] === '')
    )
    if (missing?.length) {
      toast.error(`Заполните обязательные поля: ${missing.map((f) => f.name).join(', ')}`)
      return
    }

    if (isEdit) {
      updateRecord.mutate(
        { entityId: entityId!, recordId: recordId!, data: formData },
        { onSuccess: () => navigate(backUrl) }
      )
    } else {
      createRecord.mutate(
        { entityId: entityId!, data: formData },
        { onSuccess: () => navigate(backUrl) }
      )
    }
  }

  if (entityLoading) return <div className="flex justify-center py-16"><Spinner /></div>
  if (!entity) return <div className="text-center py-16 text-slate-500">Сущность не найдена</div>

  const isSaving = createRecord.isPending || updateRecord.isPending

  // Get a label for this record (first text field value)
  const recordLabel = entity.fields
    .filter((f) => f.field_type === 'text')
    .map((f) => String(formData[f.slug] ?? ''))
    .find(Boolean)

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(backUrl)}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"
          >
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-xl font-semibold text-slate-900">
            {isEdit ? 'Редактировать запись' : `Новая запись: ${entity.name}`}
          </h1>
        </div>
        {activeTab === 'fields' && (
          <Button icon={<Save size={16} />} onClick={handleSubmit} loading={isSaving}>
            {isEdit ? 'Сохранить' : 'Создать'}
          </Button>
        )}
      </div>

      {/* Tabs — show movements tab only in edit mode */}
      {isEdit && (
        <div className="flex gap-1 border-b border-slate-200">
          {[
            { key: 'fields', label: 'Поля' },
            { key: 'movements', label: 'Движения', icon: <Package size={14} /> },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-brand-600 text-brand-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {activeTab === 'fields' ? (
        <Card>
          <CardBody>
            <form onSubmit={(e) => e.preventDefault()} className="grid grid-cols-12 gap-x-4 gap-y-5">
              {entity.fields.map((field) => {
                const width = (field.config as any)?.width ?? 'full'
                const span =
                  width === 'third' ? 'col-span-12 sm:col-span-4' :
                  width === 'half' ? 'col-span-12 sm:col-span-6' :
                  'col-span-12'
                return (
                  <div key={field.id} className={span}>
                    <FieldInput
                      field={field}
                      value={formData[field.slug]}
                      onChange={(v) => setField(field.slug, v)}
                    />
                  </div>
                )
              })}
              {entity.fields.length === 0 && (
                <p className="col-span-12 text-sm text-slate-500 text-center py-4">
                  Нет полей — добавьте поля в конструкторе
                </p>
              )}
            </form>
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <p className="text-sm font-semibold text-slate-900">Движения товара</p>
          </CardHeader>
          <CardBody>
            <MovementPanel
              entityId={entityId!}
              recordId={recordId!}
              recordLabel={recordLabel}
              entityName={entity.name}
            />
          </CardBody>
        </Card>
      )}
    </div>
  )
}
