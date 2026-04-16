import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, UserCheck, UserX, Trash2, ChevronLeft, ChevronRight } from 'lucide-react'
import { useUsers, useCreateUser, useToggleUserActive, useDeleteUser } from '@/hooks/useUsers'
import { useRoles } from '@/hooks/useRoles'
import PageHeader from '@/components/ui/PageHeader'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Card from '@/components/ui/Card'
import Badge, { StatusBadge } from '@/components/ui/Badge'
import Avatar from '@/components/ui/Avatar'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import EmptyState from '@/components/ui/EmptyState'
import Spinner from '@/components/ui/Spinner'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format } from 'date-fns'
import type { User } from '@/types/user'

const createSchema = z.object({
  first_name: z.string().min(1, 'Обязательное поле'),
  last_name: z.string().min(1, 'Обязательное поле'),
  email: z.string().email('Некорректный email'),
  password: z.string().min(8, 'Минимум 8 символов').regex(/[A-Z]/, 'Нужна заглавная буква').regex(/[0-9]/, 'Нужна цифра'),
})
type CreateForm = z.infer<typeof createSchema>

export default function UsersPage() {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null)

  const { data, isLoading } = useUsers({ page, search: search || undefined, size: 25 })
  const createUser = useCreateUser()
  const toggleActive = useToggleUserActive()
  const deleteUser = useDeleteUser()

  const { register, handleSubmit, reset, formState: { errors } } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
  })

  const onSubmit = (d: CreateForm) => {
    createUser.mutate(d, {
      onSuccess: () => { setCreateOpen(false); reset() }
    })
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Пользователи"
        description="Управление пользователями компании"
        action={
          <Button icon={<Plus size={16} />} onClick={() => setCreateOpen(true)}>
            Добавить пользователя
          </Button>
        }
      />

      {/* Filters */}
      <Card className="p-4">
        <Input
          placeholder="Поиск по имени или email..."
          leftIcon={<Search size={16} />}
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          className="max-w-sm"
        />
      </Card>

      {/* Table */}
      <Card>
        {isLoading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : !data?.items.length ? (
          <EmptyState
            title="Нет пользователей"
            description="Добавьте первого пользователя для начала работы"
            action={{ label: 'Добавить пользователя', onClick: () => setCreateOpen(true) }}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left px-6 py-3.5 font-medium text-slate-500 text-xs uppercase tracking-wide">
                      Пользователь
                    </th>
                    <th className="text-left px-6 py-3.5 font-medium text-slate-500 text-xs uppercase tracking-wide">
                      Роли
                    </th>
                    <th className="text-left px-6 py-3.5 font-medium text-slate-500 text-xs uppercase tracking-wide">
                      Статус
                    </th>
                    <th className="text-left px-6 py-3.5 font-medium text-slate-500 text-xs uppercase tracking-wide">
                      Создан
                    </th>
                    <th className="px-6 py-3.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {data.items.map((user) => (
                    <tr
                      key={user.id}
                      className="hover:bg-slate-50 transition-colors cursor-pointer"
                      onClick={() => navigate(`/users/${user.id}`)}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <Avatar name={user.full_name} size="sm" />
                          <div>
                            <p className="font-medium text-slate-900">{user.full_name}</p>
                            <p className="text-xs text-slate-500">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {user.roles.map((r) => (
                            <Badge key={r.id} variant="indigo">{r.name}</Badge>
                          ))}
                          {!user.roles.length && <span className="text-slate-400 text-xs">—</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge active={user.is_active} />
                      </td>
                      <td className="px-6 py-4 text-slate-500 text-xs">
                        {format(new Date(user.created_at), 'dd.MM.yyyy')}
                      </td>
                      <td className="px-6 py-4">
                        <div
                          className="flex items-center gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() =>
                              toggleActive.mutate({ id: user.id, active: !user.is_active })
                            }
                            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                            title={user.is_active ? 'Деактивировать' : 'Активировать'}
                          >
                            {user.is_active ? <UserX size={14} /> : <UserCheck size={14} />}
                          </button>
                          <button
                            onClick={() => setDeleteTarget(user)}
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

            {/* Pagination */}
            {data.pages > 1 && (
              <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
                <p className="text-sm text-slate-500">
                  {data.total} пользователей · стр. {data.page} из {data.pages}
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
                    disabled={page === data.pages}
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

      {/* Create modal */}
      <Modal
        open={createOpen}
        onClose={() => { setCreateOpen(false); reset() }}
        title="Добавить пользователя"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setCreateOpen(false); reset() }}>
              Отмена
            </Button>
            <Button onClick={handleSubmit(onSubmit)} loading={createUser.isPending}>
              Создать
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Имя" error={errors.first_name?.message} {...register('first_name')} />
            <Input label="Фамилия" error={errors.last_name?.message} {...register('last_name')} />
          </div>
          <Input label="Email" type="email" error={errors.email?.message} {...register('email')} />
          <Input
            label="Пароль"
            type="password"
            hint="Мин. 8 символов, заглавная и цифра"
            error={errors.password?.message}
            {...register('password')}
          />
        </form>
      </Modal>

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) {
            deleteUser.mutate(deleteTarget.id, {
              onSuccess: () => setDeleteTarget(null),
            })
          }
        }}
        loading={deleteUser.isPending}
        title="Удалить пользователя"
        description={`Удалить ${deleteTarget?.full_name}? Это действие необратимо.`}
        confirmLabel="Удалить"
      />
    </div>
  )
}
