import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Save } from 'lucide-react'
import { useRole, usePermissions, useUpdateRolePermissions } from '@/hooks/useRoles'
import Button from '@/components/ui/Button'
import Card, { CardHeader, CardBody } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Spinner from '@/components/ui/Spinner'
import { useState, useEffect } from 'react'

// Permission categories for better UX
const PERM_GROUPS: Record<string, { label: string; codes: string[] }> = {
  records: {
    label: 'Записи',
    codes: ['create', 'read', 'update', 'delete'],
  },
  users: {
    label: 'Пользователи',
    codes: ['manage_users'],
  },
  roles: {
    label: 'Роли',
    codes: ['manage_roles'],
  },
  entities: {
    label: 'Сущности',
    codes: ['manage_entities'],
  },
}

export default function RoleDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const { data: role, isLoading } = useRole(id!)
  const { data: allPermissions } = usePermissions()
  const updatePerms = useUpdateRolePermissions()

  useEffect(() => {
    if (role) {
      setSelectedIds(new Set(role.permissions.map((p) => p.id)))
    }
  }, [role])

  const toggle = (permId: string) => {
    if (role?.is_system) return
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(permId) ? next.delete(permId) : next.add(permId)
      return next
    })
  }

  const save = () => {
    updatePerms.mutate({ id: id!, permissionIds: Array.from(selectedIds) })
  }

  if (isLoading) return <div className="flex justify-center py-16"><Spinner /></div>
  if (!role) return <div className="text-center py-16 text-slate-500">Роль не найдена</div>

  // Build permission map
  const permByCode = Object.fromEntries((allPermissions ?? []).map((p) => [p.code, p]))

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/roles')} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-slate-900">{role.name}</h1>
          {role.description && <p className="text-sm text-slate-500">{role.description}</p>}
        </div>
        {!role.is_system && (
          <Button icon={<Save size={16} />} onClick={save} loading={updatePerms.isPending}>
            Сохранить
          </Button>
        )}
      </div>

      {role.is_system && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
          Системная роль — права нельзя изменить
        </div>
      )}

      <Card>
        <CardHeader>
          <p className="text-sm font-semibold text-slate-900">Матрица прав доступа</p>
        </CardHeader>
        <CardBody>
          <div className="space-y-6">
            {Object.entries(PERM_GROUPS).map(([key, group]) => (
              <div key={key}>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                  {group.label}
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {group.codes.map((code) => {
                    const perm = permByCode[code]
                    if (!perm) return null
                    const checked = selectedIds.has(perm.id)
                    return (
                      <label
                        key={code}
                        className={`flex items-center gap-2.5 p-3 rounded-xl border-2 transition-all ${
                          role.is_system
                            ? 'cursor-default'
                            : 'cursor-pointer hover:border-brand-300'
                        } ${
                          checked
                            ? 'border-brand-500 bg-brand-50'
                            : 'border-slate-100 bg-white'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggle(perm.id)}
                          disabled={role.is_system}
                          className="accent-brand-600"
                        />
                        <span className={`text-sm font-medium ${checked ? 'text-brand-700' : 'text-slate-700'}`}>
                          {code}
                        </span>
                      </label>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  )
}
