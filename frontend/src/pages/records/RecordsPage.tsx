import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useState, useMemo, useRef, useEffect } from 'react'
import {
  Plus, Search, Trash2, Edit2, ChevronLeft, ChevronRight,
  ArrowLeft, SlidersHorizontal, Package, Filter, X, Check,
} from 'lucide-react'
import { cn } from '@/utils/cn'
import { useQuery } from '@tanstack/react-query'
import { entitiesApi } from '@/api/entities'
import { useEntity, useEntityRecords, useDeleteRecord } from '@/hooks/useEntities'
import PageHeader from '@/components/ui/PageHeader'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Input from '@/components/ui/Input'
import Badge from '@/components/ui/Badge'
import EmptyState from '@/components/ui/EmptyState'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import Spinner from '@/components/ui/Spinner'
import { format, differenceInDays } from 'date-fns'
import { ru } from 'date-fns/locale'
import type { EntityRecord, EntityField } from '@/types/entity'

// ─── RelationCell ─────────────────────────────────────────────────────────────
function RelationCell({
  field,
  value,
  navigate,
}: {
  field: EntityField
  value: string
  navigate: ReturnType<typeof useNavigate>
}) {
  const relEntityId = (field.config as any)?.entity_id as string | undefined
  const displayField = (field.config as any)?.display_field as string | undefined

  const { data: records } = useQuery({
    queryKey: ['records', relEntityId],
    queryFn: () => entitiesApi.listRecords(relEntityId!, { size: 200 }),
    enabled: !!relEntityId,
    staleTime: 30_000,
  })

  const relRecord = records?.items.find((r) => r.id === value)
  const label = relRecord
    ? displayField
      ? String(relRecord.data[displayField] ?? value.slice(0, 8))
      : value.slice(0, 8)
    : value.slice(0, 8) + '…'

  if (!relEntityId) {
    return <span className="text-xs font-mono text-slate-400">{value.slice(0, 8)}…</span>
  }

  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        navigate(`/entities/${relEntityId}/records`, { state: { highlightId: value } })
      }}
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-900/40 transition-colors text-xs"
      title="Открыть связанную запись">
      🔗 {label}
    </button>
  )
}

function formatValue(
  field: EntityField,
  value: unknown,
  navigate: ReturnType<typeof useNavigate>,
): React.ReactNode {
  if (value === null || value === undefined || value === '')
    return <span className="text-slate-300 dark:text-slate-600">—</span>

  switch (field.field_type) {
    case 'boolean':
      return value
        ? <Badge variant="green">Да</Badge>
        : <Badge variant="gray">Нет</Badge>
    case 'select': {
      const opts = (field.config as any)?.options ?? []
      const opt = opts.find((o: any) => o.value === value)
      return opt
        ? <Badge variant="indigo">{opt.label}</Badge>
        : <span className="text-xs text-slate-500">{String(value)}</span>
    }
    case 'date':
      try {
        return <span>{format(new Date(String(value)), 'dd MMM yyyy', { locale: ru })}</span>
      } catch { return <span>{String(value)}</span> }
    case 'expiry_date': {
      try {
        const d = new Date(String(value))
        const days = differenceInDays(d, new Date())
        const label = format(d, 'dd.MM.yyyy')
        if (days < 0) return <Badge variant="red">⛔ {label}</Badge>
        if (days === 0) return <Badge variant="red">🔴 Сегодня</Badge>
        const warnDays = (field.config as any)?.warn_days ?? 30
        if (days <= warnDays) return <Badge variant="yellow">⚠️ {label} ({days}д)</Badge>
        return <Badge variant="green">{label}</Badge>
      } catch { return <span>{String(value)}</span> }
    }
    case 'quantity_unit': {
      const v = value as any
      if (v?.value !== undefined)
        return <span className="font-medium">{v.value} <span className="text-slate-400 text-xs">{v.unit ?? ''}</span></span>
      return <span>{String(value)}</span>
    }
    case 'barcode':
      return <code className="text-xs font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">{String(value)}</code>
    case 'relation':
      // Handled by <RelationCell> directly in the table to allow hook usage
      return <span className="text-xs font-mono text-slate-400">{String(value).slice(0, 8)}…</span>
    case 'email':
      return <a href={`mailto:${value}`} className="text-brand-600 hover:underline" onClick={(e) => e.stopPropagation()}>{String(value)}</a>
    case 'phone':
      return <a href={`tel:${value}`} className="text-brand-600 hover:underline" onClick={(e) => e.stopPropagation()}>{String(value)}</a>
    case 'price': {
      const symbol = (field.config as any)?.symbol ?? ''
      const decimals = (field.config as any)?.decimals ?? 2
      const num = parseFloat(String(value))
      if (isNaN(num)) return <span className="text-slate-700 dark:text-slate-300">{String(value)}</span>
      const formatted = num.toLocaleString('ru-RU', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
      return <span className="font-medium text-slate-700 dark:text-slate-200">{formatted} <span className="text-slate-400 text-xs">{symbol}</span></span>
    }
    case 'autoincrement':
      return <code className="text-xs font-mono bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-md">{String(value)}</code>
    case 'formula': {
      // Backend stores float when no prefix/suffix, string when affixes applied
      if (typeof value === 'number') {
        return <span className="font-semibold text-slate-800 dark:text-slate-200">{value.toLocaleString('ru-RU', { maximumFractionDigits: 4 })}</span>
      }
      return <span className="font-semibold text-slate-800 dark:text-slate-200">{String(value)}</span>
    }
    case 'currency_convert': {
      const decimals = (field.config as any)?.decimals ?? 2
      const to = String((field.config as any)?.to ?? '').toUpperCase()
      const num = typeof value === 'number' ? value : parseFloat(String(value))
      if (isNaN(num)) return <span className="text-slate-700 dark:text-slate-300">{String(value)}</span>
      const formatted = num.toLocaleString('ru-RU', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
      return <span className="font-medium text-emerald-700 dark:text-emerald-400">{formatted} <span className="text-slate-400 text-xs">{to}</span></span>
    }
    case 'warehouse_location':
      return (
        <span className="inline-flex items-center gap-1 text-xs font-mono bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-md">
          📍 {String(value)}
        </span>
      )
    case 'status': {
      const opts = (field.config as any)?.options ?? []
      const opt = opts.find((o: any) => o.value === value)
      if (!opt) return <span className="text-xs text-slate-400">{String(value)}</span>
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border"
          style={{ backgroundColor: opt.color + '22', borderColor: opt.color, color: opt.color }}>
          ● {opt.label}
        </span>
      )
    }
    case 'image': {
      const url = String(value)
      return (
        <a href={url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
          <img src={url} alt="" className="h-8 w-8 object-cover rounded-lg border border-slate-200 dark:border-slate-700" />
        </a>
      )
    }
    case 'file': {
      const url = String(value)
      const name = decodeURIComponent(url.split('/').pop() ?? 'файл')
      return (
        <a href={url} download={name}
          className="flex items-center gap-1 text-xs text-brand-600 hover:underline"
          onClick={(e) => e.stopPropagation()}>
          📎 {name.length > 20 ? name.slice(0, 20) + '…' : name}
        </a>
      )
    }
    case 'url': {
      const href = String(value)
      const display = href.replace(/^https?:\/\//, '').slice(0, 30)
      return (
        <a href={href} target="_blank" rel="noreferrer"
          className="flex items-center gap-1 text-xs text-brand-600 hover:underline"
          onClick={(e) => e.stopPropagation()}>
          🌐 {display}{href.replace(/^https?:\/\//, '').length > 30 ? '…' : ''}
        </a>
      )
    }
    default:
      return <span className="text-slate-700 dark:text-slate-300 truncate">{String(value)}</span>
  }
}

// ─── FilterPanel ─────────────────────────────────────────────────────────────
const FILTERABLE_TYPES = new Set(['status', 'select', 'boolean'])

function FilterPill({
  label,
  active,
  color,
  onClick,
}: {
  label: React.ReactNode
  active: boolean
  color?: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={active && color ? { backgroundColor: color, borderColor: color, color: '#fff' } : {}}
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
        active && !color
          ? 'bg-brand-600 border-brand-600 text-white shadow-sm'
          : !active
          ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'
          : ''
      )}
    >
      {active && !color && <Check size={10} strokeWidth={3} />}
      {label}
    </button>
  )
}

function FilterPanel({
  fields,
  filters,
  onChange,
  onReset,
}: {
  fields: EntityField[]
  filters: Record<string, string>
  onChange: (slug: string, value: string) => void
  onReset: () => void
}) {
  const filterable = fields.filter((f) => FILTERABLE_TYPES.has(f.field_type))
  const activeCount = Object.values(filters).filter((v) => v !== '').length

  if (filterable.length === 0)
    return (
      <div className="px-5 py-5 text-sm text-slate-400 dark:text-slate-500 text-center italic">
        Нет полей для фильтрации
      </div>
    )

  return (
    <div className="px-5 py-4 space-y-4">
      {filterable.map((f) => {
        const value = filters[f.slug] ?? ''

        if (f.field_type === 'boolean') {
          const boolOpts = [
            { value: '', label: 'Все' },
            { value: 'true', label: 'Да' },
            { value: 'false', label: 'Нет' },
          ]
          return (
            <div key={f.id} className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-28 shrink-0">
                {f.name}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {boolOpts.map((o) => (
                  <FilterPill
                    key={o.value}
                    label={o.label}
                    active={value === o.value}
                    onClick={() => onChange(f.slug, o.value)}
                  />
                ))}
              </div>
            </div>
          )
        }

        const opts: { value: string; label: string; color?: string }[] =
          (f.config as any)?.options ?? []
        return (
          <div key={f.id} className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-28 shrink-0">
              {f.name}
            </span>
            <div className="flex flex-wrap gap-1.5">
              <FilterPill
                label="Все"
                active={value === ''}
                onClick={() => onChange(f.slug, '')}
              />
              {opts.map((o) => (
                <FilterPill
                  key={o.value}
                  label={
                    f.field_type === 'status' && o.color ? (
                      <span className="flex items-center gap-1.5">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ background: o.color }}
                        />
                        {o.label}
                      </span>
                    ) : (
                      o.label
                    )
                  }
                  active={value === o.value}
                  color={f.field_type === 'status' ? o.color : undefined}
                  onClick={() => onChange(f.slug, o.value)}
                />
              ))}
            </div>
          </div>
        )
      })}

      {activeCount > 0 && (
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-3">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Активных фильтров:{' '}
            <span className="font-semibold text-brand-600 dark:text-brand-400">{activeCount}</span>
          </span>
          <button
            onClick={onReset}
            className="ml-auto flex items-center gap-1.5 text-xs font-medium text-red-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
          >
            <X size={12} />
            Сбросить все
          </button>
        </div>
      )}
    </div>
  )
}

// ─── RecordsPage ─────────────────────────────────────────────────────────────
export default function RecordsPage() {
  const { entityId } = useParams<{ entityId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const backUrl: string = (location.state as any)?.backUrl ?? '/entities'
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<EntityRecord | null>(null)
  const [showColMenu, setShowColMenu] = useState(false)
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(new Set())
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState<Record<string, string>>({})

  const colWidthsKey = `entity-col-widths:${entityId}`
  const [colWidths, setColWidths] = useState<Record<string, number>>(() => {
    try { return JSON.parse(localStorage.getItem(colWidthsKey) ?? '{}') } catch { return {} }
  })
  useEffect(() => {
    localStorage.setItem(colWidthsKey, JSON.stringify(colWidths))
  }, [colWidths, colWidthsKey])

  const resizingRef = useRef<{ slug: string; startX: number; startWidth: number } | null>(null)
  const startColResize = (e: React.MouseEvent, slug: string, currentWidth: number) => {
    e.preventDefault()
    resizingRef.current = { slug, startX: e.clientX, startWidth: currentWidth }
    const onMove = (ev: MouseEvent) => {
      const r = resizingRef.current
      if (!r) return
      const width = Math.max(60, r.startWidth + (ev.clientX - r.startX))
      setColWidths((prev) => ({ ...prev, [r.slug]: width }))
    }
    const onUp = () => {
      resizingRef.current = null
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  const activeFilters = useMemo(
    () => Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== '')),
    [filters]
  )
  const activeFilterCount = Object.keys(activeFilters).length

  const { data: entity, isLoading: entityLoading } = useEntity(entityId!)
  const { data: records, isLoading } = useEntityRecords(entityId!, {
    page,
    size: 25,
    search: search.trim() || undefined,
    filters: activeFilterCount > 0 ? activeFilters : undefined,
  })
  const deleteRecord = useDeleteRecord()

  const [highlightId, setHighlightId] = useState<string | undefined>(
    (location.state as any)?.highlightId as string | undefined
  )
  const highlightRef = useRef<HTMLTableRowElement>(null)

  // Sync when navigating to the same page (component doesn't remount, only location changes)
  useEffect(() => {
    const id = (location.state as any)?.highlightId as string | undefined
    if (id) setHighlightId(id)
  }, [location.state]) // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll + highlight once records are in the DOM
  useEffect(() => {
    if (!highlightId || !records) return
    // rAF ensures the browser has painted the rows before we try to scroll
    const raf = requestAnimationFrame(() => {
      if (highlightRef.current) {
        highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
        window.history.replaceState({}, '', window.location.pathname)
      }
    })
    const timer = setTimeout(() => setHighlightId(undefined), 2500)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(timer)
    }
  }, [highlightId, records]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleCol = (slug: string) =>
    setHiddenCols((prev) => { const n = new Set(prev); n.has(slug) ? n.delete(slug) : n.add(slug); return n })

  function handleFilterChange(slug: string, value: string) {
    setFilters((prev) => ({ ...prev, [slug]: value }))
    setPage(1)
  }

  function resetFilters() {
    setFilters({})
    setPage(1)
  }

  if (entityLoading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>
  if (!entity) return <div className="text-center py-16 text-slate-500">Сущность не найдена</div>

  const visibleFields = entity.fields.filter((f) => !hiddenCols.has(f.slug))

  return (
    <div className="space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <button onClick={() => navigate(backUrl)}
          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 mr-1">
          <ArrowLeft size={16} />
        </button>
        <button onClick={() => navigate(backUrl)} className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
          Назад
        </button>
        <span className="text-slate-300 dark:text-slate-600">/</span>
        <span className="font-medium text-slate-900 dark:text-slate-100">{entity.name}</span>
      </div>

      <PageHeader
        title={`${entity.icon ?? '📋'} ${entity.name}`}
        description={entity.description ?? `${entity.fields.length} полей · ${records?.total ?? 0} записей`}
        action={
          <Button icon={<Plus size={16} />} onClick={() => navigate(`${location.pathname}/new`, { state: { backUrl: location.pathname } })}>
            Добавить запись
          </Button>
        }
      />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <Input placeholder="Поиск по всем полям..." leftIcon={<Search size={16} />}
          value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          className="max-w-sm" />

        <div className="flex items-center gap-2 ml-auto">
          <Button
            variant="secondary" size="sm"
            icon={<Filter size={14} className={activeFilterCount > 0 ? 'text-brand-600' : ''} />}
            onClick={() => setShowFilters((v) => !v)}
          >
            Фильтры {activeFilterCount > 0 && (
              <span className="ml-1 min-w-[18px] h-[18px] rounded-full bg-brand-600 text-white text-xs inline-flex items-center justify-center px-1">
                {activeFilterCount}
              </span>
            )}
          </Button>

          {activeFilterCount > 0 && (
            <button onClick={resetFilters}
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              title="Сбросить фильтры">
              <X size={14} />
            </button>
          )}

          <div className="relative">
            <Button variant="secondary" size="sm" icon={<SlidersHorizontal size={14} />}
              onClick={() => setShowColMenu((v) => !v)}>
              Столбцы {hiddenCols.size > 0 && `(${visibleFields.length}/${entity.fields.length})`}
            </Button>
            {showColMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowColMenu(false)} />
                <div className="absolute right-0 top-full mt-2 z-20 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-modal py-2 min-w-[200px] animate-scale-in">
                  <div className="flex items-center justify-between px-3 pb-1.5 border-b border-slate-100 dark:border-slate-800 mb-1">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Столбцы</p>
                    <button className="text-xs text-brand-600 hover:text-brand-700"
                      onClick={() => setHiddenCols(new Set())}>Все</button>
                  </div>
                  {entity.fields.map((f) => (
                    <label key={f.id} className="flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
                      <input type="checkbox" checked={!hiddenCols.has(f.slug)} onChange={() => toggleCol(f.slug)}
                        className="accent-brand-600 w-3.5 h-3.5" />
                      <span className="text-sm text-slate-700 dark:text-slate-300">{f.name}</span>
                      <Badge variant="gray" className="ml-auto text-xs">{f.field_type}</Badge>
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <Card>
          <div className="flex items-center justify-between px-4 pt-3 pb-1">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <Filter size={14} /> Фильтры
            </p>
            <button onClick={() => setShowFilters(false)}
              className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
              <X size={14} />
            </button>
          </div>
          <FilterPanel
            fields={entity.fields}
            filters={filters}
            onChange={handleFilterChange}
            onReset={resetFilters}
          />
        </Card>
      )}

      {/* Table card */}
      <Card>
        {isLoading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : !records?.items.length ? (
          <EmptyState
            title="Нет записей"
            description={search || activeFilterCount > 0 ? 'По вашему запросу ничего не найдено' : 'Добавьте первую запись'}
            action={!search && !activeFilterCount ? {
              label: 'Добавить запись',
              onClick: () => navigate(`${location.pathname}/new`, { state: { backUrl: location.pathname } }),
            } : undefined}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" style={{ tableLayout: 'fixed' }}>
                <colgroup>
                  <col style={{ width: 40 }} />
                  {visibleFields.map((f) => (
                    <col key={f.id} style={{ width: colWidths[f.slug] ?? 180 }} />
                  ))}
                  <col style={{ width: 110 }} />
                  <col style={{ width: 64 }} />
                </colgroup>
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40">
                    <th className="text-left px-4 py-3 text-xs text-slate-400 font-medium whitespace-nowrap">#</th>
                    {visibleFields.map((f) => (
                      <th key={f.id}
                        className="relative text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                        <div className="truncate pr-2">
                          {f.name}
                          {f.is_required && <span className="text-red-400 ml-0.5">*</span>}
                        </div>
                        <div
                          onMouseDown={(e) => startColResize(e, f.slug, colWidths[f.slug] ?? 180)}
                          className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize hover:bg-brand-400/50 active:bg-brand-500 select-none"
                        />
                      </th>
                    ))}
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap">
                      Создан
                    </th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                  {records.items.map((record, idx) => (
                    <tr key={record.id}
                      ref={record.id === highlightId ? highlightRef : undefined}
                      className={cn(
                        'transition-all duration-700 group cursor-pointer',
                        record.id === highlightId
                          ? 'bg-amber-50 dark:bg-amber-900/20 outline outline-2 outline-amber-300 dark:outline-amber-700'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                      )}
                      onClick={() => navigate(`${location.pathname}/${record.id}/edit`, { state: { backUrl: location.pathname } })}>
                      <td className="px-4 py-3.5 text-xs text-slate-400 font-mono">
                        {(page - 1) * 25 + idx + 1}
                      </td>
                      {visibleFields.map((f) => (
                        <td key={f.id} className="px-4 py-3.5">
                          <div className="truncate">
                            {f.field_type === 'relation' && record.data[f.slug]
                              ? <RelationCell field={f} value={String(record.data[f.slug])} navigate={navigate} />
                              : formatValue(f, record.data[f.slug], navigate)
                            }
                          </div>
                        </td>
                      ))}
                      <td className="px-4 py-3.5 text-slate-400 text-xs whitespace-nowrap">
                        {format(new Date(record.created_at), 'dd.MM.yy HH:mm')}
                      </td>
                      <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => {
                              navigate(`${location.pathname}/${record.id}/edit`, { state: { backUrl: location.pathname } })
                              setTimeout(() => {
                                const btn = document.querySelector<HTMLButtonElement>('[data-tab="movements"]')
                                btn?.click()
                              }, 100)
                            }}
                            className="p-1.5 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-slate-400 hover:text-emerald-600 transition-colors"
                            title="Движения товара">
                            <Package size={13} />
                          </button>
                          <button
                            onClick={() => navigate(`${location.pathname}/${record.id}/edit`, { state: { backUrl: location.pathname } })}
                            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-brand-600 transition-colors"
                            title="Редактировать">
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(record)}
                            className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500 transition-colors"
                            title="Удалить">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {records.pages > 1 && (
              <div className="px-4 py-3.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {records.total} записей · страница {records.page} из {records.pages}
                </p>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" disabled={page === 1} onClick={() => setPage(1)} title="Первая">«</Button>
                  <Button variant="ghost" size="sm" disabled={page === 1} icon={<ChevronLeft size={14} />} onClick={() => setPage((p) => p - 1)} />
                  <span className="px-3 text-sm font-medium text-slate-700 dark:text-slate-300">{page}</span>
                  <Button variant="ghost" size="sm" disabled={page === records.pages} onClick={() => setPage((p) => p + 1)}>
                    <ChevronRight size={14} />
                  </Button>
                  <Button variant="ghost" size="sm" disabled={page === records.pages} onClick={() => setPage(records.pages)} title="Последняя">»</Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      <ConfirmDialog
        open={!!deleteTarget} onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return
          deleteRecord.mutate(
            { entityId: entityId!, recordId: deleteTarget.id },
            { onSuccess: () => setDeleteTarget(null) }
          )
        }}
        loading={deleteRecord.isPending}
        title="Удалить запись?"
        description="Запись будет удалена безвозвратно. Отменить действие невозможно."
        confirmLabel="Удалить"
      />
    </div>
  )
}
