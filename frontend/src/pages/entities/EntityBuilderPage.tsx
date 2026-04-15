import { useNavigate, useParams } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { ArrowLeft, Plus, Trash2, GripVertical, Save } from 'lucide-react'
import { useEntity, useCreateEntity, useUpdateEntity } from '@/hooks/useEntities'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Card, { CardHeader, CardBody } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Spinner from '@/components/ui/Spinner'
import toast from 'react-hot-toast'
import type { FieldType, EntityFieldCreate } from '@/types/entity'

// DND kit imports
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const FIELD_TYPES: { type: FieldType; label: string; icon: string }[] = [
  { type: 'text', label: 'Текст', icon: '📝' },
  { type: 'number', label: 'Число', icon: '🔢' },
  { type: 'email', label: 'Email', icon: '📧' },
  { type: 'phone', label: 'Телефон', icon: '📱' },
  { type: 'date', label: 'Дата', icon: '📅' },
  { type: 'boolean', label: 'Да/Нет', icon: '✅' },
  { type: 'select', label: 'Список', icon: '📋' },
]

const COLORS = [
  '#6366f1',
  '#8b5cf6',
  '#ec4899',
  '#ef4444',
  '#f97316',
  '#22c55e',
  '#06b6d4',
  '#3b82f6',
]

interface FieldDraft extends EntityFieldCreate {
  _id: string
}

function slugifyEntity(str: string) {
  return str
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 50)
}

function slugifyField(str: string) {
  return str
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 50)
}

interface SortableFieldProps {
  field: FieldDraft
  updateField: (fid: string, patch: Partial<FieldDraft>) => void
  removeField: (fid: string) => void
}

function SortableField({ field, updateField, removeField }: SortableFieldProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: field._id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`p-4 flex items-start gap-3 bg-white ${
        isDragging ? 'shadow-lg ring-1 ring-slate-200 rounded-lg' : ''
      }`}
    >
      <div
        {...attributes}
        {...listeners}
        className="mt-3 text-slate-300 cursor-grab active:cursor-grabbing hover:text-slate-400"
      >
        <GripVertical size={16} />
      </div>
      <div className="flex-1 grid grid-cols-2 gap-3">
        <Input
          label="Название"
          value={field.name}
          onChange={(e) => updateField(field._id, { name: e.target.value })}
        />
        <div>
          <label className="label">Тип</label>
          <Badge variant="indigo" className="mt-2">
            {FIELD_TYPES.find((t) => t.type === field.field_type)?.icon}{' '}
            {FIELD_TYPES.find((t) => t.type === field.field_type)?.label}
          </Badge>
        </div>
        <div className="col-span-2 flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={field.is_required}
              onChange={(e) => updateField(field._id, { is_required: e.target.checked })}
              className="accent-brand-600"
            />
            Обязательное
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={field.is_searchable}
              onChange={(e) => updateField(field._id, { is_searchable: e.target.checked })}
              className="accent-brand-600"
            />
            Поиск
          </label>
        </div>
      </div>
      <button
        onClick={() => removeField(field._id)}
        className="mt-7 p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
      >
        <Trash2 size={14} />
      </button>
    </div>
  )
}

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
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  useEffect(() => {
    if (existing) {
      setName(existing.name)
      setSlug(existing.slug)
      setDescription(existing.description ?? '')
      setIcon(existing.icon ?? '📋')
      setColor(existing.color ?? '#6366f1')
      setFields(
        existing.fields
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
          }))
      )
    }
  }, [existing])

  const addField = (type: FieldType) => {
    const label = FIELD_TYPES.find((t) => t.type === type)?.label ?? type
    const newField: FieldDraft = {
      _id: Math.random().toString(36).substring(2, 9),
      name: `${label} ${fields.length + 1}`,
      slug: slugifyField(`${label}_${fields.length + 1}`),
      field_type: type,
      is_required: false,
      is_searchable: true,
      position: fields.length,
      config: type === 'select' ? { options: [{ value: 'option_1', label: 'Вариант 1' }] } : undefined,
    }
    setFields((f) => [...f, newField])
  }

  const removeField = (fid: string) => {
    setFields((f) => f.filter((x) => x._id !== fid))
  }

  const updateField = (fid: string, patch: Partial<FieldDraft>) => {
    setFields((f) =>
      f.map((x) => {
        if (x._id !== fid) return x
        const updated = { ...x, ...patch }
        if (patch.name !== undefined) updated.slug = slugifyField(patch.name)
        return updated
      })
    )
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setFields((items) => {
        const oldIndex = items.findIndex((i) => i._id === active.id)
        const newIndex = items.findIndex((i) => i._id === over.id)
        return arrayMove(items, oldIndex, newIndex)
      })
    }
  }

  const handleSave = () => {
    if (!name.trim()) return toast.error('Укажите название')
    if (!slug.trim()) return toast.error('Укажите slug')

    const payload = {
      name,
      slug,
      description: description || undefined,
      icon,
      color,
      fields: fields.map((f, i) => ({
        name: f.name,
        slug: f.slug,
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
      createEntity.mutate(payload, {
        onSuccess: () => navigate('/entities'),
      })
    }
  }

  if (isEdit && isLoading)
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    )

  const isSaving = createEntity.isPending || updateEntity.isPending

  return (
    <div className="max-w-4xl space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/entities')}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"
          >
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-xl font-semibold text-slate-900">
            {isEdit ? 'Редактировать сущность' : 'Создать сущность'}
          </h1>
        </div>
        <Button icon={<Save size={16} />} onClick={handleSave} loading={isSaving}>
          {isEdit ? 'Сохранить' : 'Создать'}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left — metadata */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <p className="text-sm font-semibold text-slate-900">Основное</p>
            </CardHeader>
            <CardBody className="space-y-4">
              <Input
                label="Название"
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  if (!isEdit) setSlug(slugifyEntity(e.target.value))
                }}
                placeholder="Клиенты"
                required
              />
              <Input
                label="Slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="klienty"
                hint="Уникальный идентификатор"
              />
              <Input
                label="Описание"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Описание сущности..."
              />
              <div>
                <label className="label">Иконка</label>
                <Input
                  value={icon}
                  onChange={(e) => setIcon(e.target.value)}
                  placeholder="📋"
                  hint="Emoji иконка"
                />
              </div>
              <div>
                <label className="label">Цвет</label>
                <div className="flex gap-2 flex-wrap">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setColor(c)}
                      className={`w-8 h-8 rounded-lg border-2 transition-transform ${
                        color === c ? 'border-slate-900 scale-110' : 'border-transparent'
                      }`}
                      style={{ background: c }}
                    />
                  ))}
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Field type palette */}
          <Card>
            <CardHeader>
              <p className="text-sm font-semibold text-slate-900">Добавить поле</p>
            </CardHeader>
            <CardBody className="grid grid-cols-2 gap-2 p-4">
              {FIELD_TYPES.map((ft) => (
                <button
                  key={ft.type}
                  onClick={() => addField(ft.type)}
                  className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 hover:border-brand-300 hover:bg-brand-50 transition-colors text-left"
                >
                  <span className="text-lg">{ft.icon}</span>
                  <span className="text-xs font-medium text-slate-700">{ft.label}</span>
                </button>
              ))}
            </CardBody>
          </Card>
        </div>

        {/* Right — field list */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-900">Поля ({fields.length})</p>
              </div>
            </CardHeader>
            <CardBody className="p-0">
              {fields.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-sm text-slate-500">Добавьте поля из палитры слева</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext
                      items={fields.map((f) => f._id)}
                      strategy={verticalListSortingStrategy}
                    >
                      {fields.map((field) => (
                        <SortableField
                          key={field._id}
                          field={field}
                          updateField={updateField}
                          removeField={removeField}
                        />
                      ))}
                    </SortableContext>
                  </DndContext>
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  )
}
