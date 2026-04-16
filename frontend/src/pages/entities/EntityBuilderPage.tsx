import { useNavigate, useParams } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { ArrowLeft, Plus, Trash2, GripVertical, Save, X, ChevronDown, ChevronUp } from 'lucide-react'
import { useEntity, useCreateEntity, useUpdateEntity } from '@/hooks/useEntities'
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
  { type: 'text',    label: 'Текст',    icon: '📝', desc: 'Строка текста' },
  { type: 'number',  label: 'Число',    icon: '🔢', desc: 'Числовое значение' },
  { type: 'email',   label: 'Email',    icon: '📧', desc: 'Адрес эл. почты' },
  { type: 'phone',   label: 'Телефон',  icon: '📱', desc: 'Номер телефона' },
  { type: 'date',    label: 'Дата',     icon: '📅', desc: 'Дата (ГГГГ-ММ-ДД)' },
  { type: 'boolean', label: 'Да / Нет', icon: '✅', desc: 'Флаг / чекбокс' },
  { type: 'select',  label: 'Список',   icon: '📋', desc: 'Выпадающий список' },
]

const COLORS = ['#6366f1','#8b5cf6','#ec4899','#ef4444','#f97316','#eab308','#22c55e','#06b6d4','#3b82f6','#64748b']
const ICONS  = ['📋','👤','🏢','💼','📦','🎯','🔑','📊','💬','🗂️','🏷️','📌','⚡','🔔','💡']

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

// ─── Sortable Field Row ─────────────────────────────────────────────────────
function SortableField({ field, updateField, removeField, toggleExpand }: {
  field: FieldDraft
  updateField: (id: string, p: Partial<FieldDraft>) => void
  removeField: (id: string) => void
  toggleExpand: (id: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: field._id })

  const style = { transform: CSS.Transform.toString(transform), transition,
    zIndex: isDragging ? 50 : undefined, opacity: isDragging ? 0.5 : 1 }

  const ft = FIELD_TYPES.find((t) => t.type === field.field_type)
  const options: SelectOption[] = (field.config as any)?.options ?? []
  const numConfig: Record<string, unknown> = (field.config as any) ?? {}
  const hasConfig = field.field_type === 'select' || field.field_type === 'number'

  return (
    <div ref={setNodeRef} style={style}
      className={`bg-white border-b border-slate-100 last:border-b-0 ${isDragging ? 'shadow-lg rounded-xl ring-2 ring-brand-200' : ''}`}>
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
              <Badge variant="indigo" className="text-xs">{ft?.label}</Badge>
            </div>
          </div>
          {/* Slug */}
          <div className="col-span-2">
            <label className="label">Slug (ключ)</label>
            <input className="input text-xs font-mono text-slate-500" value={field.slug}
              onChange={(e) => updateField(field._id, { slug: slugifyField(e.target.value) })} />
          </div>
          {/* Checkboxes */}
          <div className="col-span-2 flex items-center gap-6">
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
        </div>
      )}
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
          _expanded: f.field_type === 'select' || f.field_type === 'number',
        }))
    )
  }, [existing])

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
      config: type === 'select' ? { options: [{ value: 'option_1', label: 'Вариант 1' }] }
             : type === 'number' ? {} : undefined,
      _expanded: type === 'select' || type === 'number',
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
    <div className="max-w-4xl space-y-5">
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left */}
        <div className="space-y-4">
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

          <Card>
            <CardHeader><p className="text-sm font-semibold text-slate-900">Добавить поле</p></CardHeader>
            <div className="p-3 space-y-1">
              {FIELD_TYPES.map((ft) => (
                <button key={ft.type} type="button" onClick={() => addField(ft.type)}
                  className="w-full flex items-center gap-3 p-2.5 rounded-xl border border-slate-200 hover:border-brand-300 hover:bg-brand-50 transition-colors text-left group">
                  <span className="text-lg shrink-0">{ft.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-700 group-hover:text-brand-700">{ft.label}</p>
                    <p className="text-xs text-slate-400 truncate">{ft.desc}</p>
                  </div>
                  <Plus size={12} className="text-slate-300 group-hover:text-brand-500 shrink-0" />
                </button>
              ))}
            </div>
          </Card>
        </div>

        {/* Right — fields */}
        <div className="lg:col-span-2">
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
              <div className="py-16 text-center">
                <div className="text-5xl mb-3 opacity-40">🏗️</div>
                <p className="text-sm font-medium text-slate-500">Нет полей</p>
                <p className="text-xs text-slate-400 mt-1">Выберите тип поля слева чтобы добавить</p>
              </div>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={fields.map((f) => f._id)} strategy={verticalListSortingStrategy}>
                  {fields.map((field) => (
                    <SortableField key={field._id} field={field}
                      updateField={updateField} removeField={removeField} toggleExpand={toggleExpand} />
                  ))}
                </SortableContext>
              </DndContext>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
