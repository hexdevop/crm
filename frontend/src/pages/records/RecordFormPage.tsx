import { useParams, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { ArrowLeft, Save } from 'lucide-react'
import { useEntity, useCreateRecord, useUpdateRecord } from '@/hooks/useEntities'
import { entitiesApi } from '@/api/entities'
import { useQuery } from '@tanstack/react-query'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Card, { CardBody } from '@/components/ui/Card'
import Spinner from '@/components/ui/Spinner'
import toast from 'react-hot-toast'
import type { EntityField } from '@/types/entity'

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

    default:
      return (
        <Input
          label={field.name}
          type={field.field_type === 'email' ? 'email' : 'text'}
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          required={field.is_required}
          placeholder={`Введите ${field.name.toLowerCase()}...`}
        />
      )
  }
}

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
  const createRecord = useCreateRecord()
  const updateRecord = useUpdateRecord()

  useEffect(() => {
    if (existingRecord) setFormData(existingRecord.data)
  }, [existingRecord])

  const setField = (slug: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [slug]: value }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    // Validate required
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
        <Button icon={<Save size={16} />} onClick={handleSubmit} loading={isSaving}>
          {isEdit ? 'Сохранить' : 'Создать'}
        </Button>
      </div>

      <Card>
        <CardBody>
          <form onSubmit={handleSubmit} className="space-y-5">
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
    </div>
  )
}
