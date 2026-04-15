import { useParams, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { Plus, Search, Trash2, Edit2, ChevronLeft, ChevronRight, ArrowLeft } from 'lucide-react'
import { useEntity, useEntityRecords, useDeleteRecord } from '@/hooks/useEntities'
import PageHeader from '@/components/ui/PageHeader'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Input from '@/components/ui/Input'
import EmptyState from '@/components/ui/EmptyState'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import Spinner from '@/components/ui/Spinner'
import { format } from 'date-fns'
import type { EntityRecord } from '@/types/entity'

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'boolean') return value ? 'Да' : 'Нет'
  if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}$/)) {
    try { return format(new Date(value), 'dd.MM.yyyy') } catch { return value }
  }
  return String(value)
}

export default function RecordsPage() {
  const { entityId } = useParams<{ entityId: string }>()
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<EntityRecord | null>(null)

  const { data: entity, isLoading: entityLoading } = useEntity(entityId!)
  const { data: records, isLoading } = useEntityRecords(entityId!, {
    page,
    search: search || undefined,
  })
  const deleteRecord = useDeleteRecord()

  if (entityLoading) return <div className="flex justify-center py-16"><Spinner /></div>
  if (!entity) return <div className="text-center py-16 text-slate-500">Сущность не найдена</div>

  const visibleFields = entity.fields.slice(0, 5)

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 mb-1">
        <button
          onClick={() => navigate('/entities')}
          className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"
        >
          <ArrowLeft size={18} />
        </button>
        <span className="text-sm text-slate-500">Сущности</span>
        <span className="text-slate-300">/</span>
        <span className="text-sm font-medium text-slate-900">{entity.name}</span>
      </div>

      <PageHeader
        title={entity.name}
        description={entity.description ?? `${entity.fields.length} полей`}
        action={
          <Button
            icon={<Plus size={16} />}
            onClick={() => navigate(`/entities/${entityId}/records/new`)}
          >
            Добавить запись
          </Button>
        }
      />

      <Card className="p-4">
        <Input
          placeholder="Поиск..."
          leftIcon={<Search size={16} />}
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          className="max-w-sm"
        />
      </Card>

      <Card>
        {isLoading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : !records?.items.length ? (
          <EmptyState
            title="Нет записей"
            description="Добавьте первую запись"
            action={{
              label: 'Добавить запись',
              onClick: () => navigate(`/entities/${entityId}/records/new`),
            }}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    {visibleFields.map((f) => (
                      <th
                        key={f.id}
                        className="text-left px-6 py-3.5 font-medium text-slate-500 text-xs uppercase tracking-wide whitespace-nowrap"
                      >
                        {f.name}
                        {f.is_required && <span className="text-red-400 ml-1">*</span>}
                      </th>
                    ))}
                    <th className="text-left px-6 py-3.5 font-medium text-slate-500 text-xs uppercase tracking-wide">
                      Создан
                    </th>
                    <th className="px-6 py-3.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {records.items.map((record) => (
                    <tr key={record.id} className="hover:bg-slate-50 transition-colors">
                      {visibleFields.map((f) => (
                        <td key={f.id} className="px-6 py-4 text-slate-900 max-w-[200px] truncate">
                          {formatValue(record.data[f.slug])}
                        </td>
                      ))}
                      <td className="px-6 py-4 text-slate-500 text-xs whitespace-nowrap">
                        {format(new Date(record.created_at), 'dd.MM.yyyy HH:mm')}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() =>
                              navigate(`/entities/${entityId}/records/${record.id}/edit`)
                            }
                            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(record)}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {records.pages > 1 && (
              <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
                <p className="text-sm text-slate-500">
                  {records.total} записей · стр. {records.page} из {records.pages}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={page === 1}
                    onClick={() => setPage((p) => p - 1)}
                    icon={<ChevronLeft size={14} />}
                  >
                    Назад
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={page === records.pages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Вперёд <ChevronRight size={14} />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) {
            deleteRecord.mutate(
              { entityId: entityId!, recordId: deleteTarget.id },
              { onSuccess: () => setDeleteTarget(null) }
            )
          }
        }}
        loading={deleteRecord.isPending}
        title="Удалить запись"
        description="Удалить запись? Это действие необратимо."
        confirmLabel="Удалить"
      />
    </div>
  )
}
