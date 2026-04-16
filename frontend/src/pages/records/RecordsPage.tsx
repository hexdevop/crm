import { useParams, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import {
  Plus, Search, Trash2, Edit2, ChevronLeft, ChevronRight,
  ArrowLeft, SlidersHorizontal,
} from 'lucide-react'
import { useEntity, useEntityRecords, useDeleteRecord } from '@/hooks/useEntities'
import PageHeader from '@/components/ui/PageHeader'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Input from '@/components/ui/Input'
import Badge from '@/components/ui/Badge'
import EmptyState from '@/components/ui/EmptyState'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import Spinner from '@/components/ui/Spinner'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import type { EntityRecord, EntityField } from '@/types/entity'

function formatValue(field: EntityField, value: unknown): React.ReactNode {
  if (value === null || value === undefined || value === '')
    return <span className="text-slate-300">—</span>

  switch (field.field_type) {
    case 'boolean':
      return value ? <Badge variant="green">Да</Badge> : <Badge variant="gray">Нет</Badge>
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
    case 'email':
      return <a href={`mailto:${value}`} className="text-brand-600 hover:underline" onClick={(e) => e.stopPropagation()}>{String(value)}</a>
    case 'phone':
      return <a href={`tel:${value}`} className="text-brand-600 hover:underline" onClick={(e) => e.stopPropagation()}>{String(value)}</a>
    default:
      return <span className="text-slate-700 truncate">{String(value)}</span>
  }
}

export default function RecordsPage() {
  const { entityId } = useParams<{ entityId: string }>()
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<EntityRecord | null>(null)
  const [showColMenu, setShowColMenu] = useState(false)
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(new Set())

  const { data: entity, isLoading: entityLoading } = useEntity(entityId!)
  const { data: records, isLoading } = useEntityRecords(entityId!, {
    page, size: 25, search: search.trim() || undefined,
  })
  const deleteRecord = useDeleteRecord()

  const toggleCol = (slug: string) =>
    setHiddenCols((prev) => { const n = new Set(prev); n.has(slug) ? n.delete(slug) : n.add(slug); return n })

  if (entityLoading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>
  if (!entity) return <div className="text-center py-16 text-slate-500">Сущность не найдена</div>

  const visibleFields = entity.fields.filter((f) => !hiddenCols.has(f.slug))

  return (
    <div className="space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <button onClick={() => navigate('/entities')}
          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 mr-1">
          <ArrowLeft size={16} />
        </button>
        <button onClick={() => navigate('/entities')} className="text-slate-500 hover:text-slate-700">
          Сущности
        </button>
        <span className="text-slate-300">/</span>
        <span className="font-medium text-slate-900">{entity.name}</span>
      </div>

      <PageHeader
        title={`${entity.icon ?? '📋'} ${entity.name}`}
        description={entity.description ?? `${entity.fields.length} полей · ${records?.total ?? 0} записей`}
        action={
          <Button icon={<Plus size={16} />} onClick={() => navigate(`/entities/${entityId}/records/new`)}>
            Добавить запись
          </Button>
        }
      />

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <Input placeholder="Поиск по всем полям..." leftIcon={<Search size={16} />}
          value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          className="max-w-sm" />

        <div className="relative ml-auto">
          <Button variant="secondary" size="sm" icon={<SlidersHorizontal size={14} />}
            onClick={() => setShowColMenu((v) => !v)}>
            Столбцы {hiddenCols.size > 0 && `(${visibleFields.length}/${entity.fields.length})`}
          </Button>
          {showColMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowColMenu(false)} />
              <div className="absolute right-0 top-full mt-2 z-20 bg-white rounded-xl border border-slate-200 shadow-modal py-2 min-w-[200px] animate-scale-in">
                <div className="flex items-center justify-between px-3 pb-1.5 border-b border-slate-100 mb-1">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Столбцы</p>
                  <button className="text-xs text-brand-600 hover:text-brand-700"
                    onClick={() => setHiddenCols(new Set())}>Все</button>
                </div>
                {entity.fields.map((f) => (
                  <label key={f.id} className="flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 cursor-pointer">
                    <input type="checkbox" checked={!hiddenCols.has(f.slug)} onChange={() => toggleCol(f.slug)}
                      className="accent-brand-600 w-3.5 h-3.5" />
                    <span className="text-sm text-slate-700">{f.name}</span>
                    <Badge variant="gray" className="ml-auto text-xs">{f.field_type}</Badge>
                  </label>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Table card */}
      <Card>
        {isLoading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : !records?.items.length ? (
          <EmptyState
            title="Нет записей"
            description={search ? 'По вашему запросу ничего не найдено' : 'Добавьте первую запись'}
            action={!search ? {
              label: 'Добавить запись',
              onClick: () => navigate(`/entities/${entityId}/records/new`),
            } : undefined}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/60">
                    <th className="text-left px-4 py-3 text-xs text-slate-400 font-medium w-10 whitespace-nowrap">#</th>
                    {visibleFields.map((f) => (
                      <th key={f.id}
                        className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                        {f.name}
                        {f.is_required && <span className="text-red-400 ml-0.5">*</span>}
                      </th>
                    ))}
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap">
                      Создан
                    </th>
                    <th className="px-4 py-3 w-16" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {records.items.map((record, idx) => (
                    <tr key={record.id}
                      className="hover:bg-slate-50 transition-colors group cursor-pointer"
                      onClick={() => navigate(`/entities/${entityId}/records/${record.id}/edit`)}>
                      <td className="px-4 py-3.5 text-xs text-slate-400 font-mono">
                        {(page - 1) * 25 + idx + 1}
                      </td>
                      {visibleFields.map((f) => (
                        <td key={f.id} className="px-4 py-3.5 max-w-[200px]">
                          <div className="truncate">{formatValue(f, record.data[f.slug])}</div>
                        </td>
                      ))}
                      <td className="px-4 py-3.5 text-slate-400 text-xs whitespace-nowrap">
                        {format(new Date(record.created_at), 'dd.MM.yy HH:mm')}
                      </td>
                      <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => navigate(`/entities/${entityId}/records/${record.id}/edit`)}
                            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-brand-600 transition-colors"
                            title="Редактировать">
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(record)}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
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
              <div className="px-4 py-3.5 border-t border-slate-100 flex items-center justify-between">
                <p className="text-sm text-slate-500">
                  {records.total} записей · страница {records.page} из {records.pages}
                </p>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" disabled={page === 1}
                    onClick={() => setPage(1)} title="Первая">«</Button>
                  <Button variant="ghost" size="sm" disabled={page === 1}
                    icon={<ChevronLeft size={14} />} onClick={() => setPage((p) => p - 1)} />
                  <span className="px-3 text-sm font-medium text-slate-700">{page}</span>
                  <Button variant="ghost" size="sm" disabled={page === records.pages}
                    onClick={() => setPage((p) => p + 1)}>
                    <ChevronRight size={14} />
                  </Button>
                  <Button variant="ghost" size="sm" disabled={page === records.pages}
                    onClick={() => setPage(records.pages)} title="Последняя">»</Button>
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
