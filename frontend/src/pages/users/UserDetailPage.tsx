import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Shield, Plus, X } from 'lucide-react'
import { useUser, useAssignRole, useRemoveRole, useToggleUserActive } from '@/hooks/useUsers'
import { useRoles } from '@/hooks/useRoles'
import Button from '@/components/ui/Button'
import Card, { CardHeader, CardBody } from '@/components/ui/Card'
import Badge, { StatusBadge } from '@/components/ui/Badge'
import Avatar from '@/components/ui/Avatar'
import Spinner from '@/components/ui/Spinner'
import Modal from '@/components/ui/Modal'
import { useState } from 'react'
import { format } from 'date-fns'

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [assignRoleOpen, setAssignRoleOpen] = useState(false)
  const [selectedRoleId, setSelectedRoleId] = useState('')

  const { data: user, isLoading } = useUser(id!)
  const { data: roles } = useRoles()
  const assignRole = useAssignRole()
  const removeRole = useRemoveRole()
  const toggleActive = useToggleUserActive()

  if (isLoading) return <div className="flex justify-center py-16"><Spinner /></div>
  if (!user) return <div className="text-center py-16 text-slate-500">Пользователь не найден</div>

  const assignedRoleIds = new Set(user.roles.map((r) => r.id))
  const availableRoles = roles?.filter((r) => !assignedRoleIds.has(r.id)) ?? []

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/users')}
          className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-xl font-semibold text-slate-900">Профиль пользователя</h1>
      </div>

      {/* Main info */}
      <Card>
        <CardBody>
          <div className="flex items-start gap-5">
            <Avatar name={user.full_name} size="lg" />
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold text-slate-900">{user.full_name}</h2>
                <StatusBadge active={user.is_active} />
                {user.is_superadmin && <Badge variant="purple">Superadmin</Badge>}
              </div>
              <p className="text-sm text-slate-500 mt-0.5">{user.email}</p>
              {user.telegram_username && (
                <p className="text-sm text-slate-500 mt-0.5">
                  Telegram: @{user.telegram_username}
                </p>
              )}
              <p className="text-xs text-slate-400 mt-2">
                Зарегистрирован {format(new Date(user.created_at), 'dd.MM.yyyy HH:mm')}
              </p>
            </div>
            <Button
              variant={user.is_active ? 'secondary' : 'primary'}
              size="sm"
              onClick={() =>
                toggleActive.mutate({ id: user.id, active: !user.is_active })
              }
              loading={toggleActive.isPending}
            >
              {user.is_active ? 'Деактивировать' : 'Активировать'}
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Roles */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield size={16} className="text-slate-500" />
              <h3 className="text-sm font-semibold text-slate-900">Роли</h3>
            </div>
            <Button
              variant="secondary"
              size="sm"
              icon={<Plus size={14} />}
              onClick={() => setAssignRoleOpen(true)}
              disabled={availableRoles.length === 0}
            >
              Назначить роль
            </Button>
          </div>
        </CardHeader>
        <CardBody className="pt-0">
          {user.roles.length === 0 ? (
            <p className="text-sm text-slate-500 py-2">Нет назначенных ролей</p>
          ) : (
            <div className="space-y-2">
              {user.roles.map((role) => (
                <div
                  key={role.id}
                  className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-50"
                >
                  <div className="flex items-center gap-2">
                    <Shield size={14} className="text-brand-500" />
                    <span className="text-sm font-medium text-slate-900">{role.name}</span>
                    {role.system_type && (
                      <Badge variant="gray" className="text-xs">{role.system_type}</Badge>
                    )}
                  </div>
                  <button
                    onClick={() => removeRole.mutate({ userId: user.id, roleId: role.id })}
                    className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Assign role modal */}
      <Modal
        open={assignRoleOpen}
        onClose={() => { setAssignRoleOpen(false); setSelectedRoleId('') }}
        title="Назначить роль"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setAssignRoleOpen(false); setSelectedRoleId('') }}>
              Отмена
            </Button>
            <Button
              disabled={!selectedRoleId}
              loading={assignRole.isPending}
              onClick={() => {
                assignRole.mutate(
                  { userId: user.id, roleId: selectedRoleId },
                  { onSuccess: () => { setAssignRoleOpen(false); setSelectedRoleId('') } }
                )
              }}
            >
              Назначить
            </Button>
          </>
        }
      >
        <div className="space-y-2">
          {availableRoles.map((role) => (
            <label
              key={role.id}
              className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors ${
                selectedRoleId === role.id
                  ? 'border-brand-500 bg-brand-50'
                  : 'border-slate-100 hover:border-slate-200'
              }`}
            >
              <input
                type="radio"
                name="role"
                value={role.id}
                checked={selectedRoleId === role.id}
                onChange={(e) => setSelectedRoleId(e.target.value)}
                className="sr-only"
              />
              <Shield size={16} className="text-brand-500" />
              <div>
                <p className="text-sm font-medium text-slate-900">{role.name}</p>
                {role.description && (
                  <p className="text-xs text-slate-500">{role.description}</p>
                )}
              </div>
            </label>
          ))}
          {availableRoles.length === 0 && (
            <p className="text-sm text-slate-500 text-center py-4">Все роли уже назначены</p>
          )}
        </div>
      </Modal>
    </div>
  )
}
