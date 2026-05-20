import { useParams, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { ArrowLeft, Save, Package } from 'lucide-react'
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

  const { data: records } = useQuery({
    queryKey: ['records', relEntityId],
    queryFn: () => entitiesApi.listRecords(relEntityId!, { size: 200 }),
    enabled: !!relEntityId,
  })

  return (
    <div>
      <label className="label">
        {field.name}
        {field.is_required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <select
        value={String(value ?? '')}
        onChange={(e) => onChange(e.target.value || null)}
        className="input"
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

  useEffect(() => {
    if (existingRecord) setFormData(existingRecord.data)
  }, [existingRecord])

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
        { onSuccess: () => navigate(`/entities/${entityId}/records`) }
      )
    } else {
      createRecord.mutate(
        { entityId: entityId!, data: formData },
        { onSuccess: () => navigate(`/entities/${entityId}/records`) }
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
            onClick={() => navigate(`/entities/${entityId}/records`)}
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
            <form onSubmit={(e) => e.preventDefault()} className="space-y-5">
              {entity.fields.map((field) => (
                <FieldInput
                  key={field.id}
                  field={field}
                  value={formData[field.slug]}
                  onChange={(v) => setField(field.slug, v)}
                />
              ))}
              {entity.fields.length === 0 && (
                <p className="text-sm text-slate-500 text-center py-4">
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
