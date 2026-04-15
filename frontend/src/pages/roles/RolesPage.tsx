import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Shield, Trash2, Lock } from 'lucide-react'
import { useRoles, useCreateRole, useDeleteRole } from '@/hooks/useRoles'
import PageHeader from '@/components/ui/PageHeader'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import EmptyState from '@/components/ui/EmptyState'
import Input from '@/components/ui/Input'
import Spinner from '@/components/ui/Spinner'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { Role } from '@/types/role'

const createSchema = z.object({
  name: z.string().min(2, 'Минимум 2 символа'),
  description: z.string().optional(),
})
type CreateForm = z.infer<typeof createSchema>

export default function RolesPage() {
  const navigate = useNavigate()
  const [createOpen, setCreateOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Role | null>(null)

  const { data: roles, isLoading } = useRoles()
  const createRole = useCreateRole()
  const deleteRole = useDeleteRole()

  const { register, handleSubmit, reset, formState: { errors } } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
  })

  const onSubmit = (d: CreateForm) => {
    createRole.mutate(d, {
      onSuccess: () => { setCreateOpen(false); reset() }
    })
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Роли"
        description="Управление ролями и правами доступа"
        action={
          <Button icon={<Plus size={16} />} onClick={() => setCreateOpen(true)}>
            Создать роль
          </Button>
        }
      />

      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : !roles?.length ? (
        <Card>
          <EmptyState title="Нет ролей" />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {roles.map((role) => (
            <Card
              key={role.id}
              hover
              onClick={() => navigate(`/roles/${role.id}`)}
              className="p-5 group"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center">
                    {role.is_system ? (
                      <Lock size={18} className="text-brand-600" />
                    ) : (
                      <Shield size={18} className="text-brand-600" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-slate-900 text-sm">{role.name}</p>
                      {role.is_system && <Badge variant="gray">Системная</Badge>}
                    </div>
                    {role.description && (
                      <p className="text-xs text-slate-500 mt-0.5">{role.description}</p>
                    )}
                  </div>
                </div>
                {!role.is_system && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeleteTarget(role) }}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-xs text-slate-500 mb-2">Права доступа</p>
                <div className="flex flex-wrap gap-1">
                  {role.permissions.slice(0, 4).map((p) => (
                    <Badge key={p.id} variant="blue">{p.code}</Badge>
                  ))}
                  {role.permissions.length > 4 && (
                    <Badge variant="gray">+{role.permissions.length - 4}</Badge>
                  )}
                  {!role.permissions.length && (
                    <span className="text-xs text-slate-400">Нет прав</span>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create modal */}
      <Modal
        open={createOpen}
        onClose={() => { setCreateOpen(false); reset() }}
        title="Создать роль"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setCreateOpen(false); reset() }}>Отмена</Button>
            <Button onClick={handleSubmit(onSubmit)} loading={createRole.isPending}>Создать</Button>
          </>
        }
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input label="Название" error={errors.name?.message} {...register('name')} />
          <Input label="Описание" {...register('description')} />
        </form>
      </Modal>

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) {
            deleteRole.mutate(deleteTarget.id, {
              onSuccess: () => setDeleteTarget(null),
            })
          }
        }}
        loading={deleteRole.isPending}
        title="Удалить роль"
        description={`Удалить роль "${deleteTarget?.name}"?`}
        confirmLabel="Удалить"
      />
    </div>
  )
}
