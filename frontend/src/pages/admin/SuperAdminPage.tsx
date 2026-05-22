import { useState, useMemo } from 'react'
import {
  Building2, Users, Shield, Edit2, Trash2, X,
  Search, CheckCircle, XCircle, Clock, AlertTriangle,
  ShieldOff, ArrowLeft, Database, ExternalLink,
  ToggleLeft, ToggleRight,
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { companiesApi } from '@/api/companies'
import type { Company, CompanyUpdate } from '@/api/companies'
import { useUsers, useToggleUserActive, useDeleteUser, useUpdateUser, useAssignRole, useRemoveRole } from '@/hooks/useUsers'
import { useRoles, useDeleteRole, useUpdateRole, useUpdateRolePermissions, usePermissions } from '@/hooks/useRoles'
import { useEntities } from '@/hooks/useEntities'
import { useIsSuperAdmin } from '@/store/auth.store'
import Card, { CardHeader, CardBody } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Avatar from '@/components/ui/Avatar'
import Input from '@/components/ui/Input'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import Spinner from '@/components/ui/Spinner'
import PageHeader from '@/components/ui/PageHeader'
import toast from 'react-hot-toast'
import { format, differenceInDays } from 'date-fns'
import { ru } from 'date-fns/locale'
import type { User } from '@/types/user'
import type { Role } from '@/types/role'

// ─── Helpers ─────────────────────────────────────────────────────────────────

type BadgeVariant = 'green' | 'yellow' | 'red' | 'gray' | 'indigo'

function getCompanyExpirationStatus(expiresAt: string | null | undefined): { label: string; variant: BadgeVariant } {
  if (!expiresAt) return { label: 'Без ограничений', variant: 'gray' }
  const d = new Date(expiresAt)
  if (d < new Date()) return { label: 'Истёк', variant: 'red' }
  const days = differenceInDays(d, new Date())
  if (days <= 3) return { label: `Истекает через ${days} дн.`, variant: 'yellow' }
  return { label: format(d, 'dd MMM yyyy', { locale: ru }), variant: 'green' }
}

function todayString() { return format(new Date(), 'yyyy-MM-dd') }

// ─── Tab: Overview ────────────────────────────────────────────────────────────

function OverviewTab({ companies, usersTotal }: { companies: Company[]; usersTotal: number }) {
  const active = companies.filter((c) => c.is_active).length
  const inactive = companies.length - active

  const stats = [
    { label: 'Всего компаний', value: companies.length, icon: Building2, color: 'bg-indigo-500' },
    { label: 'Активных компаний', value: active, icon: CheckCircle, color: 'bg-emerald-500' },
    { label: 'Неактивных', value: inactive, icon: XCircle, color: 'bg-slate-400' },
    { label: 'Всего пользователей', value: usersTotal, icon: Users, color: 'bg-blue-500' },
  ]

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardBody>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl ${s.color} flex items-center justify-center shrink-0`}>
                  <s.icon size={18} className="text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{s.value}</p>
                  <p className="text-xs text-slate-500">{s.label}</p>
                </div>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><p className="text-sm font-semibold text-slate-900">Последние компании</p></CardHeader>
        <div className="divide-y divide-slate-50">
          {companies.slice(0, 8).map((c) => (
            <div key={c.id} className="flex items-center gap-3 px-5 py-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
                <Building2 size={14} className="text-indigo-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">{c.name}</p>
                <p className="text-xs text-slate-400 truncate">{c.slug}</p>
              </div>
              <Badge variant={c.is_active ? 'green' : 'gray'} dot>
                {c.is_active ? 'Активна' : 'Неактивна'}
              </Badge>
              <p className="text-xs text-slate-400 whitespace-nowrap">
                {format(new Date(c.created_at), 'dd MMM yyyy', { locale: ru })}
              </p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

// ─── Company Detail View ──────────────────────────────────────────────────────

const COMPANY_TABS = [
  { id: 'users',    label: 'Пользователи', icon: Users },
  { id: 'roles',    label: 'Роли',         icon: Shield },
  { id: 'entities', label: 'Сущности',     icon: Database },
  { id: 'info',     label: 'Информация',   icon: Building2 },
]

function CompanyDetailView({ company }: { company: Company }) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [ctab, setCtab] = useState('users')
  const [editForm, setEditForm] = useState({ name: company.name, description: company.description ?? '' })
  const [deleteUserTarget, setDeleteUserTarget] = useState<User | null>(null)
  const [deleteRoleTarget, setDeleteRoleTarget] = useState<{ id: string; name: string } | null>(null)

  // User edit state
  const [editUserId, setEditUserId] = useState<string | null>(null)
  const [editUserForm, setEditUserForm] = useState({ first_name: '', last_name: '', email: '' })

  // Role edit state
  const [editRoleId, setEditRoleId] = useState<string | null>(null)
  const [editRoleName, setEditRoleName] = useState('')
  const [editRolePerms, setEditRolePerms] = useState<Set<string>>(new Set())

  const { data: usersData, isLoading: usersLoading } = useUsers({ size: 100, company_id: company.id })
  const { data: roles, isLoading: rolesLoading } = useRoles({ company_id: company.id })
  const { data: entities, isLoading: entitiesLoading } = useEntities({ company_id: company.id })
  const { data: allPermissions = [] } = usePermissions()

  const updateCompany = useMutation({
    mutationFn: (data: { name: string; description?: string }) => companiesApi.update(company.id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['companies'] }); toast.success('Обновлено') },
    onError: () => toast.error('Ошибка'),
  })

  const toggleUser = useToggleUserActive()
  const deleteUser = useDeleteUser()
  const deleteRole = useDeleteRole()
  const updateUser = useUpdateUser()
  const assignRole = useAssignRole()
  const removeRole = useRemoveRole()
  const updateRole = useUpdateRole()
  const updateRolePerms = useUpdateRolePermissions()

  const users = usersData?.items ?? []

  // Derived: current edit targets (live from query cache)
  const editUserTarget = editUserId ? users.find(u => u.id === editUserId) ?? null : null
  const editRoleTarget = editRoleId ? (roles ?? []).find(r => r.id === editRoleId) ?? null : null

  function openEditUser(user: User) {
    setEditUserId(user.id)
    setEditUserForm({ first_name: user.first_name, last_name: user.last_name, email: user.email })
  }

  function openEditRole(role: Role) {
    setEditRoleId(role.id)
    setEditRoleName(role.name)
    setEditRolePerms(new Set(role.permissions.map(p => p.id)))
  }

  function handleSaveUser() {
    if (!editUserId) return
    updateUser.mutate(
      { id: editUserId, data: editUserForm },
      { onSuccess: () => setEditUserId(null) }
    )
  }

  function handleSaveRole() {
    if (!editRoleId) return
    const doClose = () => setEditRoleId(null)
    if (editRoleTarget && editRoleName !== editRoleTarget.name) {
      updateRole.mutate({ id: editRoleId, data: { name: editRoleName } })
    }
    updateRolePerms.mutate(
      { id: editRoleId, permissionIds: Array.from(editRolePerms) },
      { onSuccess: doClose }
    )
  }

  const availableRolesToAdd = (roles ?? []).filter(
    r => !editUserTarget?.roles.some(ur => ur.id === r.id)
  )

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/admin/companies')}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft size={16} />
          Компании
        </button>
        <span className="text-slate-300">/</span>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
            <Building2 size={13} className="text-indigo-600" />
          </div>
          <span className="font-semibold text-slate-900">{company.name}</span>
          <Badge variant={company.is_active ? 'green' : 'gray'} dot>
            {company.is_active ? 'Активна' : 'Неактивна'}
          </Badge>
        </div>
      </div>

      <div className="flex border-b border-slate-200 gap-1">
        {COMPANY_TABS.map((t) => (
          <button key={t.id} onClick={() => setCtab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              ctab === t.id ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}>
            <t.icon size={15} />
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Users tab ── */}
      {ctab === 'users' && (
        <Card>
          {usersLoading ? <div className="flex justify-center py-12"><Spinner /></div> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/60">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Пользователь</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Email</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Роли</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Статус</th>
                    <th className="px-5 py-3 w-32" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {users.length === 0 ? (
                    <tr><td colSpan={5} className="px-5 py-12 text-center text-slate-400 text-sm">Нет пользователей</td></tr>
                  ) : users.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/70 transition-colors group">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={u.full_name} size="sm" />
                          <span className="font-medium text-slate-900">{u.full_name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-slate-500">{u.email}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex flex-wrap gap-1">
                          {u.roles.length > 0 ? u.roles.map((r) => <Badge key={r.id} variant="indigo">{r.name}</Badge>) : <span className="text-slate-300 text-xs">—</span>}
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge variant={u.is_active ? 'green' : 'gray'} dot>{u.is_active ? 'Активен' : 'Неактивен'}</Badge>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                          <button
                            onClick={() => openEditUser(u)}
                            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-brand-600 transition-colors"
                            title="Редактировать"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => toggleUser.mutate({ id: u.id, active: !u.is_active })}
                            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-brand-600 transition-colors"
                            title={u.is_active ? 'Деактивировать' : 'Активировать'}
                          >
                            {u.is_active ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                          </button>
                          <button
                            onClick={() => setDeleteUserTarget(u)}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                            title="Удалить"
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
          )}
        </Card>
      )}

      {/* ── Roles tab ── */}
      {ctab === 'roles' && (
        <Card>
          {rolesLoading ? <div className="flex justify-center py-12"><Spinner /></div> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/60">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Роль</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Тип</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Разрешения</th>
                    <th className="px-5 py-3 w-24" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {(!roles || roles.length === 0) ? (
                    <tr><td colSpan={4} className="px-5 py-12 text-center text-slate-400 text-sm">Нет ролей</td></tr>
                  ) : roles.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/70 transition-colors group">
                      <td className="px-5 py-3.5 font-medium text-slate-900">{r.name}</td>
                      <td className="px-5 py-3.5">
                        {r.is_system ? <Badge variant="indigo">Системная</Badge> : <Badge variant="gray">Пользовательская</Badge>}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-slate-500">{r.permissions.map((p) => p.code).join(', ') || '—'}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                          <button
                            onClick={() => openEditRole(r)}
                            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-brand-600 transition-colors"
                            title="Редактировать роль"
                          >
                            <Edit2 size={14} />
                          </button>
                          {!r.is_system && (
                            <button
                              onClick={() => setDeleteRoleTarget({ id: r.id, name: r.name })}
                              className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                              title="Удалить роль"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* ── Entities tab ── */}
      {ctab === 'entities' && (
        <Card>
          {entitiesLoading ? <div className="flex justify-center py-12"><Spinner /></div> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/60">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Сущность</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Slug</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Полей</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Записей</th>
                    <th className="px-5 py-3 w-36" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {(!entities || entities.length === 0) ? (
                    <tr><td colSpan={5} className="px-5 py-12 text-center text-slate-400 text-sm">Нет сущностей</td></tr>
                  ) : entities.map((e) => (
                    <tr key={e.id} className="hover:bg-slate-50/70 transition-colors group">
                      <td className="px-5 py-3.5">
                        <span className="font-medium text-slate-900">{e.icon} {e.name}</span>
                      </td>
                      <td className="px-5 py-3.5"><code className="text-xs text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{e.slug}</code></td>
                      <td className="px-5 py-3.5 text-slate-500">{e.fields?.length ?? 0}</td>
                      <td className="px-5 py-3.5 text-slate-500">{(e as any).record_count ?? 0}</td>
                      <td className="px-5 py-3.5">
                        <button
                          onClick={() => navigate(
                            `/admin/companies/${company.id}/entities/${e.id}/records`,
                            { state: { backUrl: `/admin/companies/${company.id}` } }
                          )}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-brand-600 bg-brand-50 hover:bg-brand-100 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <ExternalLink size={12} />
                          Записи
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* ── Info tab ── */}
      {ctab === 'info' && (
        <Card>
          <CardHeader><p className="text-sm font-semibold text-slate-900">Информация о компании</p></CardHeader>
          <CardBody>
            <div className="space-y-4 max-w-sm">
              <Input
                label="Название"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              />
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Описание</label>
                <textarea
                  rows={3}
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent resize-none"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  loading={updateCompany.isPending}
                  disabled={!editForm.name.trim()}
                  onClick={() => updateCompany.mutate({ name: editForm.name, description: editForm.description || undefined })}
                >
                  Сохранить
                </Button>
              </div>
              <div className="pt-2 border-t border-slate-100 text-xs text-slate-500 space-y-1">
                <p>Slug: <code className="bg-slate-100 px-1 rounded">{company.slug}</code></p>
                <p>Создана: {format(new Date(company.created_at), 'dd MMMM yyyy', { locale: ru })}</p>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {/* ── Confirm dialogs ── */}
      <ConfirmDialog
        open={!!deleteUserTarget}
        onClose={() => setDeleteUserTarget(null)}
        onConfirm={() => deleteUserTarget && deleteUser.mutate(deleteUserTarget.id, { onSuccess: () => setDeleteUserTarget(null) })}
        loading={deleteUser.isPending}
        title={`Удалить пользователя «${deleteUserTarget?.full_name}»?`}
        description="Пользователь будет удалён из системы безвозвратно."
        confirmLabel="Удалить"
      />

      <ConfirmDialog
        open={!!deleteRoleTarget}
        onClose={() => setDeleteRoleTarget(null)}
        onConfirm={() => deleteRoleTarget && deleteRole.mutate(deleteRoleTarget.id, { onSuccess: () => setDeleteRoleTarget(null) })}
        loading={deleteRole.isPending}
        title={`Удалить роль «${deleteRoleTarget?.name}»?`}
        description="Роль будет удалена у всех пользователей, которым она назначена."
        confirmLabel="Удалить"
      />

      {/* ── Edit User Modal ── */}
      <Modal
        open={!!editUserId && !!editUserTarget}
        onClose={() => setEditUserId(null)}
        title={`Редактировать пользователя`}
      >
        {editUserTarget && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 pb-2 border-b border-slate-100">
              <Avatar name={editUserTarget.full_name} size="sm" />
              <div>
                <p className="text-sm font-semibold text-slate-900">{editUserTarget.full_name}</p>
                <p className="text-xs text-slate-500">{editUserTarget.email}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Имя"
                value={editUserForm.first_name}
                onChange={e => setEditUserForm({ ...editUserForm, first_name: e.target.value })}
              />
              <Input
                label="Фамилия"
                value={editUserForm.last_name}
                onChange={e => setEditUserForm({ ...editUserForm, last_name: e.target.value })}
              />
            </div>
            <Input
              label="Email"
              value={editUserForm.email}
              onChange={e => setEditUserForm({ ...editUserForm, email: e.target.value })}
            />

            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">Роли</p>
              <div className="flex flex-wrap gap-2 mb-2 min-h-[28px]">
                {editUserTarget.roles.length > 0 ? editUserTarget.roles.map(r => (
                  <span key={r.id} className="flex items-center gap-1 px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-medium">
                    {r.name}
                    <button
                      onClick={() => removeRole.mutate({ userId: editUserTarget.id, roleId: r.id })}
                      disabled={removeRole.isPending}
                      className="hover:text-red-500 transition-colors disabled:opacity-40"
                      title="Снять роль"
                    >
                      <X size={11} />
                    </button>
                  </span>
                )) : <span className="text-xs text-slate-400">Нет ролей</span>}
              </div>
              {availableRolesToAdd.length > 0 && (
                <select
                  defaultValue=""
                  onChange={e => {
                    if (e.target.value) {
                      assignRole.mutate({ userId: editUserTarget.id, roleId: e.target.value })
                      e.target.value = ''
                    }
                  }}
                  disabled={assignRole.isPending}
                  className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50"
                >
                  <option value="">+ Добавить роль...</option>
                  {availableRolesToAdd.map(r => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button variant="ghost" onClick={() => setEditUserId(null)}>Отмена</Button>
              <Button
                loading={updateUser.isPending}
                disabled={!editUserForm.first_name.trim()}
                onClick={handleSaveUser}
              >
                Сохранить
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Edit Role Modal ── */}
      <Modal
        open={!!editRoleId && !!editRoleTarget}
        onClose={() => setEditRoleId(null)}
        title="Редактировать роль"
      >
        {editRoleTarget && (
          <div className="space-y-4">
            <Input
              label="Название роли"
              value={editRoleName}
              onChange={e => setEditRoleName(e.target.value)}
              disabled={editRoleTarget.is_system}
            />
            {editRoleTarget.is_system && (
              <p className="text-xs text-slate-400">Системные роли нельзя переименовать</p>
            )}

            <div>
              <p className="text-sm font-medium text-slate-700 mb-3">Разрешения</p>
              <div className="grid grid-cols-2 gap-2">
                {allPermissions.map(p => (
                  <label key={p.id} className="flex items-center gap-2.5 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={editRolePerms.has(p.id)}
                      onChange={() => {
                        setEditRolePerms(prev => {
                          const next = new Set(prev)
                          next.has(p.id) ? next.delete(p.id) : next.add(p.id)
                          return next
                        })
                      }}
                      className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                    />
                    <span className="text-sm text-slate-700 group-hover:text-slate-900">{p.code}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button variant="ghost" onClick={() => setEditRoleId(null)}>Отмена</Button>
              <Button
                loading={updateRolePerms.isPending || updateRole.isPending}
                disabled={!editRoleName.trim()}
                onClick={handleSaveRole}
              >
                Сохранить
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

// ─── Tab: Companies ───────────────────────────────────────────────────────────

function CompaniesTab({ companies, isLoading, onEnterCompany }: {
  companies: Company[]
  isLoading: boolean
  onEnterCompany: (c: Company) => void
}) {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [editTarget, setEditTarget] = useState<Company | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Company | null>(null)
  const [editForm, setEditForm] = useState<{ name: string; description: string }>({ name: '', description: '' })

  const updateCompany = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof companiesApi.update>[1] }) =>
      companiesApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['companies'] }); setEditTarget(null); toast.success('Компания обновлена') },
    onError: () => toast.error('Ошибка обновления'),
  })

  const deleteCompany = useMutation({
    mutationFn: companiesApi.delete,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['companies'] }); setDeleteTarget(null); toast.success('Компания удалена') },
    onError: () => toast.error('Ошибка удаления'),
  })

  const filtered = useMemo(() => {
    if (!search.trim()) return companies
    const q = search.toLowerCase()
    return companies.filter((c) => c.name.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q))
  }, [companies, search])

  function openEdit(c: Company, e: React.MouseEvent) {
    e.stopPropagation()
    setEditTarget(c)
    setEditForm({ name: c.name, description: c.description ?? '' })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Input
          placeholder="Поиск по названию или slug..."
          leftIcon={<Search size={15} />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
      </div>

      <Card>
        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <Building2 size={36} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">Компании не найдены</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Компания</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Slug</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Описание</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Статус</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Создана</th>
                  <th className="px-5 py-3 w-32" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((c) => (
                  <tr
                    key={c.id}
                    className="hover:bg-indigo-50/50 transition-colors group cursor-pointer"
                    onClick={() => onEnterCompany(c)}
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
                          <Building2 size={14} className="text-indigo-600" />
                        </div>
                        <span className="font-medium text-slate-900 group-hover:text-brand-600 transition-colors">{c.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <code className="text-xs text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{c.slug}</code>
                    </td>
                    <td className="px-5 py-3.5 text-slate-500 max-w-xs truncate">{c.description ?? <span className="text-slate-300">—</span>}</td>
                    <td className="px-5 py-3.5" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => updateCompany.mutate({ id: c.id, data: { is_active: !c.is_active } })}
                        className="group/tog"
                        title={c.is_active ? 'Деактивировать' : 'Активировать'}
                      >
                        <Badge variant={c.is_active ? 'green' : 'gray'} dot className="cursor-pointer group-hover/tog:opacity-75">
                          {c.is_active ? 'Активна' : 'Неактивна'}
                        </Badge>
                      </button>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-400 whitespace-nowrap">
                      {format(new Date(c.created_at), 'dd MMM yyyy', { locale: ru })}
                    </td>
                    <td className="px-5 py-3.5" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                        <button
                          onClick={(e) => openEdit(c, e)}
                          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-brand-600 transition-colors"
                          title="Редактировать"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeleteTarget(c) }}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                          title="Удалить"
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
        )}
      </Card>

      <Modal open={!!editTarget} onClose={() => setEditTarget(null)} title="Редактировать компанию">
        <div className="space-y-4">
          <Input
            label="Название"
            value={editForm.name}
            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
          />
          <Input
            label="Описание"
            value={editForm.description}
            onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setEditTarget(null)}>Отмена</Button>
            <Button
              loading={updateCompany.isPending}
              disabled={!editForm.name.trim()}
              onClick={() => editTarget && updateCompany.mutate({ id: editTarget.id, data: { name: editForm.name, description: editForm.description || undefined } })}
            >
              Сохранить
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteCompany.mutate(deleteTarget.id)}
        loading={deleteCompany.isPending}
        title={`Удалить компанию «${deleteTarget?.name}»?`}
        description="Все пользователи, роли и данные компании будут удалены безвозвратно."
        confirmLabel="Удалить"
      />
    </div>
  )
}

// ─── Tab: Access Expiration (per-company) ─────────────────────────────────────

function AccessTab({ companies, isLoading }: { companies: Company[]; isLoading: boolean }) {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [dateValue, setDateValue] = useState('')
  const [removeTarget, setRemoveTarget] = useState<Company | null>(null)

  const updateAccess = useMutation({
    mutationFn: ({ id, data }: { id: string; data: CompanyUpdate }) =>
      companiesApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['companies'] })
      setEditingId(null)
      toast.success('Доступ компании обновлён')
    },
    onError: () => toast.error('Ошибка обновления'),
  })

  const filteredCompanies = useMemo(() => {
    if (!search.trim()) return companies
    const q = search.toLowerCase()
    return companies.filter(c => c.name.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q))
  }, [companies, search])

  const stats = useMemo(() => ({
    active:   companies.filter(c => { const s = getCompanyExpirationStatus(c.access_expires_at); return s.variant === 'green' }).length,
    soon:     companies.filter(c => { const s = getCompanyExpirationStatus(c.access_expires_at); return s.variant === 'yellow' }).length,
    expired:  companies.filter(c => { const s = getCompanyExpirationStatus(c.access_expires_at); return s.variant === 'red' }).length,
    unlimited: companies.filter(c => !c.access_expires_at).length,
  }), [companies])

  function handleEditClick(company: Company) {
    setEditingId(company.id)
    setDateValue(company.access_expires_at
      ? format(new Date(company.access_expires_at), 'yyyy-MM-dd')
      : todayString()
    )
  }

  function handleSave(companyId: string) {
    if (!dateValue) return
    const isoDate = new Date(dateValue + 'T23:59:59').toISOString()
    updateAccess.mutate({ id: companyId, data: { access_expires_at: isoDate } })
  }

  function handleRemove(company: Company) {
    updateAccess.mutate(
      { id: company.id, data: { access_expires_at: null } },
      { onSuccess: () => { setRemoveTarget(null); toast.success('Ограничение снято') } }
    )
  }

  return (
    <div className="space-y-4">
      {!isLoading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Активных', count: stats.active, color: 'bg-emerald-500' },
            { label: 'Истекает скоро', count: stats.soon, color: 'bg-amber-500' },
            { label: 'Истёкших', count: stats.expired, color: 'bg-red-500' },
            { label: 'Без ограничений', count: stats.unlimited, color: 'bg-slate-300' },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-3 p-4 rounded-xl border border-slate-200 bg-white">
              <span className={`w-3 h-3 rounded-full shrink-0 ${s.color}`} />
              <div>
                <p className="text-xl font-bold text-slate-900">{s.count}</p>
                <p className="text-xs text-slate-500">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && stats.expired > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <AlertTriangle size={16} className="shrink-0" />
          <span><strong>{stats.expired}</strong> компания(й) с истёкшим сроком доступа.</span>
        </div>
      )}

      <Card>
        <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-3">
          <Input
            placeholder="Поиск по названию или slug..."
            leftIcon={<Search size={15} />}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="max-w-xs"
          />
          <span className="ml-auto text-xs text-slate-400">{filteredCompanies.length} из {companies.length} компаний</span>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : filteredCompanies.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <Building2 size={36} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">Компании не найдены</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Компания</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Статус</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Срок доступа</th>
                  <th className="px-5 py-3 w-64" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredCompanies.map(company => {
                  const expStatus = getCompanyExpirationStatus(company.access_expires_at)
                  const isEditing = editingId === company.id
                  return (
                    <tr key={company.id} className="hover:bg-slate-50/70 transition-colors group">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
                            <Building2 size={14} className="text-indigo-600" />
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">{company.name}</p>
                            <p className="text-xs text-slate-400">{company.slug}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge variant={company.is_active ? 'green' : 'gray'} dot>
                          {company.is_active ? 'Активна' : 'Неактивна'}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge variant={expStatus.variant} dot>{expStatus.label}</Badge>
                      </td>
                      <td className="px-5 py-3.5">
                        {isEditing ? (
                          <div className="flex items-center gap-2 flex-wrap">
                            <input
                              type="date"
                              value={dateValue}
                              min={todayString()}
                              onChange={e => setDateValue(e.target.value)}
                              className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                            />
                            <Button size="sm" loading={updateAccess.isPending} disabled={!dateValue} onClick={() => handleSave(company.id)}>Сохранить</Button>
                            <Button size="sm" variant="ghost" disabled={updateAccess.isPending} onClick={() => setEditingId(null)}>Отмена</Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleEditClick(company)}
                              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-brand-600 transition-colors"
                              title={company.access_expires_at ? 'Изменить срок' : 'Установить срок'}
                            >
                              <Edit2 size={14} />
                            </button>
                            {company.access_expires_at ? (
                              <button
                                onClick={() => setRemoveTarget(company)}
                                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 text-xs font-medium transition-colors"
                              >
                                <Trash2 size={12} />
                                Снять
                              </button>
                            ) : (
                              <Button variant="secondary" size="sm" icon={<Clock size={14} />} onClick={() => handleEditClick(company)}>
                                Ограничить
                              </Button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        onConfirm={() => removeTarget && handleRemove(removeTarget)}
        loading={updateAccess.isPending}
        title={`Снять ограничение для «${removeTarget?.name}»?`}
        description="Компания получит бессрочный доступ."
        confirmLabel="Снять ограничение"
      />
    </div>
  )
}

// ─── Access denied guard ─────────────────────────────────────────────────────

function AdminGuard({ children }: { children: React.ReactNode }) {
  const isSuperAdmin = useIsSuperAdmin()
  if (!isSuperAdmin) return (
    <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
      <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center">
        <ShieldOff size={28} className="text-red-400" />
      </div>
      <div>
        <p className="text-base font-semibold text-slate-900">Нет доступа</p>
        <p className="text-sm text-slate-500 mt-1">Доступно только суперадминистраторам</p>
      </div>
    </div>
  )
  return <>{children}</>
}

// ─── Route-level page components ─────────────────────────────────────────────

export function AdminOverviewPage() {
  const { data: companies = [] } = useQuery({
    queryKey: ['companies'],
    queryFn: companiesApi.list,
  })
  const { data: usersData } = useUsers({ size: 1 })
  return (
    <AdminGuard>
      <div className="space-y-5">
        <PageHeader title="Обзор" description="Статистика и состояние системы" />
        <OverviewTab companies={companies} usersTotal={usersData?.total ?? 0} />
      </div>
    </AdminGuard>
  )
}

export function AdminCompaniesPage() {
  const navigate = useNavigate()
  const { data: companies = [], isLoading } = useQuery({
    queryKey: ['companies'],
    queryFn: companiesApi.list,
  })
  return (
    <AdminGuard>
      <div className="space-y-5">
        <PageHeader title="Компании" description="Управление зарегистрированными компаниями" />
        <CompaniesTab
          companies={companies}
          isLoading={isLoading}
          onEnterCompany={(c) => navigate(`/admin/companies/${c.id}`)}
        />
      </div>
    </AdminGuard>
  )
}

export function AdminCompanyDetailPage() {
  const { companyId } = useParams<{ companyId: string }>()
  const { data: company, isLoading } = useQuery({
    queryKey: ['companies', companyId],
    queryFn: () => companiesApi.get(companyId!),
    enabled: !!companyId,
  })
  return (
    <AdminGuard>
      {isLoading
        ? <div className="flex justify-center py-20"><Spinner /></div>
        : !company
          ? <div className="text-center py-16 text-slate-500">Компания не найдена</div>
          : <CompanyDetailView company={company} />
      }
    </AdminGuard>
  )
}

export function AdminAccessPage() {
  const { data: companies = [], isLoading } = useQuery({
    queryKey: ['companies'],
    queryFn: companiesApi.list,
  })
  return (
    <AdminGuard>
      <div className="space-y-5">
        <PageHeader title="Временный доступ" description="Управление сроками доступа компаний" />
        <AccessTab companies={companies} isLoading={isLoading} />
      </div>
    </AdminGuard>
  )
}

export default function SuperAdminPage() {
  return null
}
