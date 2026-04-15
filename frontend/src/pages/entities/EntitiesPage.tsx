import { useNavigate } from 'react-router-dom'
import { Plus, Database, Settings2, Trash2, ArrowRight } from 'lucide-react'
import { useEntities, useDeleteEntity } from '@/hooks/useEntities'
import PageHeader from '@/components/ui/PageHeader'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import EmptyState from '@/components/ui/EmptyState'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import Spinner from '@/components/ui/Spinner'
import { useState } from 'react'
import type { Entity } from '@/types/entity'

const FIELD_TYPE_COLORS: Record<string, string> = {
  text: 'blue',
  number: 'purple',
  date: 'green',
  boolean: 'yellow',
  select: 'indigo',
  email: 'red',
  phone: 'gray',
}

export default function EntitiesPage() {
  const navigate = useNavigate()
  const [deleteTarget, setDeleteTarget] = useState<Entity | null>(null)

  const { data: entities, isLoading } = useEntities()
  const deleteEntity = useDeleteEntity()

  return (
    <div className="space-y-5">
      <PageHeader
        title="Конструктор сущностей"
        description="Создавайте пользовательские типы данных для вашего бизнеса"
        action={
          <Button icon={<Plus size={16} />} onClick={() => navigate('/entities/new')}>
            Создать сущность
          </Button>
        }
      />

      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : !entities?.length ? (
        <Card>
          <EmptyState
            icon={Database}
            title="Нет сущностей"
            description="Создайте первую сущность — например, Клиенты, Сделки или Задачи"
            action={{ label: 'Создать сущность', onClick: () => navigate('/entities/new') }}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {entities.map((entity) => (
            <Card key={entity.id} className="group overflow-hidden">
              {/* Color bar */}
              <div
                className="h-1.5"
                style={{ background: entity.color ?? '#6366f1' }}
              />
              <div className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl shrink-0"
                      style={{
                        background: entity.color ? `${entity.color}15` : '#6366f115',
                      }}
                    >
                      {entity.icon ?? '📋'}
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900">{entity.name}</h3>
                      <p className="text-xs text-slate-500">{entity.slug}</p>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => navigate(`/entities/${entity.id}/edit`)}
                      className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                      title="Редактировать"
                    >
                      <Settings2 size={14} />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(entity)}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {entity.description && (
                  <p className="text-sm text-slate-500 mb-4 line-clamp-2">{entity.description}</p>
                )}

                {/* Field types */}
                <div className="flex flex-wrap gap-1 mb-4">
                  {entity.fields.slice(0, 6).map((f) => (
                    <Badge key={f.id} variant={(FIELD_TYPE_COLORS[f.field_type] as any) ?? 'gray'}>
                      {f.name}
                    </Badge>
                  ))}
                  {entity.fields.length > 6 && (
                    <Badge variant="gray">+{entity.fields.length - 6}</Badge>
                  )}
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <div className="flex gap-4">
                    <span className="text-xs text-slate-500">
                      <span className="font-semibold text-slate-900">{entity.fields.length}</span> полей
                    </span>
                    <span className="text-xs text-slate-500">
                      <span className="font-semibold text-slate-900">{entity.record_count}</span> записей
                    </span>
                  </div>
                  <button
                    onClick={() => navigate(`/entities/${entity.id}/records`)}
                    className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700 transition-colors"
                  >
                    Открыть <ArrowRight size={12} />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) {
            deleteEntity.mutate(deleteTarget.id, {
              onSuccess: () => setDeleteTarget(null),
            })
          }
        }}
        loading={deleteEntity.isPending}
        title="Удалить сущность"
        description={`Удалить "${deleteTarget?.name}" и все её записи? Это необратимо.`}
        confirmLabel="Удалить всё"
      />
    </div>
  )
}
