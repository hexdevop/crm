import { useState, useMemo } from 'react'
import { Clock, Plus, Trash2, Edit2, Search, ShieldOff, AlertTriangle } from 'lucide-react'
import { useUsers } from '@/hooks/useUsers'
import {
  useAccessExpirations,
  useSetAccessExpiration,
  useUpdateAccessExpiration,
  useRemoveAccessExpiration,
} from '@/hooks/useAccessExpiration'
import { useIsSuperAdmin } from '@/store/auth.store'
import PageHeader from '@/components/ui/PageHeader'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Spinner from '@/components/ui/Spinner'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import Avatar from '@/components/ui/Avatar'
import Input from '@/components/ui/Input'
import { format, differenceInDays } from 'date-fns'
import { ru } from 'date-fns/locale'
import type { User } from '@/types/user'
import type { AccessExpiration } from '@/types/access_expiration'

// ─── helpers ────────────────────────────────────────────────────────────────

type BadgeVariant = 'green' | 'yellow' | 'red' | 'gray' | 'indigo'

interface ExpirationStatus {
  label: string
  variant: BadgeVariant
}

function getExpirationStatus(exp: AccessExpiration | undefined): ExpirationStatus {
  if (!exp) return { label: 'Без ограничений', variant: 'gray' }

  const expiresAt = new Date(exp.expires_at)
  if (expiresAt < new Date()) return { label: 'Истёк', variant: 'red' }

  const daysLeft = differenceInDays(expiresAt, new Date())
  if (daysLeft <= 3)
    return { label: `Истекает через ${daysLeft} дн.`, variant: 'yellow' }

  return { label: format(expiresAt, 'dd MMM yyyy', { locale: ru }), variant: 'green' }
}

function todayString() {
  return format(new Date(), 'yyyy-MM-dd')
}

// ─── component ──────────────────────────────────────────────────────────────

export default function AccessExpirationPage() {
  const isSuperAdmin = useIsSuperAdmin()

  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'limited' | 'expired' | 'unlimited'>('all')
  const [editingUserId, setEditingUserId] = useState<string | null>(null)
  const [dateValue, setDateValue] = useState('')
  const [removeTarget, setRemoveTarget] = useState<User | null>(null)

  const { data: usersData, isLoading: usersLoading } = useUsers({ size: 100 })
  const { data: expirations, isLoading: expLoading } = useAccessExpirations()

  const setExpiration = useSetAccessExpiration()
  const updateExpiration = useUpdateAccessExpiration()
  const removeExpiration = useRemoveAccessExpiration()

  const expirationMap = useMemo(() => {
    const map = new Map<string, AccessExpiration>()
    expirations?.forEach((e) => map.set(e.user_id, e))
    return map
  }, [expirations])

  const allUsers = usersData?.items ?? []
  const isLoading = usersLoading || expLoading

  const filteredUsers = useMemo(() => {
    let list = allUsers
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (u) => u.full_name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
      )
    }
    if (filterStatus !== 'all') {
      list = list.filter((u) => {
        const exp = expirationMap.get(u.id)
        const status = getExpirationStatus(exp)
        if (filterStatus === 'unlimited') return status.variant === 'gray'
        if (filterStatus === 'expired') return status.variant === 'red'
        if (filterStatus === 'limited') return status.variant === 'green' || status.variant === 'yellow'
        return true
      })
    }
    return list
  }, [allUsers, search, filterStatus, expirationMap])

  const stats = useMemo(() => ({
    active: allUsers.filter((u) => {
      const e = expirationMap.get(u.id)
      return e && getExpirationStatus(e).variant === 'green'
    }).length,
    soon: allUsers.filter((u) => {
      const e = expirationMap.get(u.id)
      return e && getExpirationStatus(e).variant === 'yellow'
    }).length,
    expired: allUsers.filter((u) => {
      const e = expirationMap.get(u.id)
      return e && getExpirationStatus(e).variant === 'red'
    }).length,
    unlimited: allUsers.filter((u) => !expirationMap.has(u.id)).length,
  }), [allUsers, expirationMap])

  // ── Guards ──────────────────────────────────────────────────────────────────
  if (!isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center">
          <ShieldOff size={28} className="text-red-400" />
        </div>
        <div>
          <p className="text-base font-semibold text-slate-900">Нет доступа</p>
          <p className="text-sm text-slate-500 mt-1">Управление временным доступом доступно только суперадминам</p>
        </div>
      </div>
    )
  }

  // ── Handlers ────────────────────────────────────────────────────────────────
  function handleEditClick(user: User) {
    const existing = expirationMap.get(user.id)
    setEditingUserId(user.id)
    setDateValue(existing ? format(new Date(existing.expires_at), 'yyyy-MM-dd') : todayString())
  }

  function handleCancel() {
    setEditingUserId(null)
    setDateValue('')
  }

  function handleSave(user: User) {
    if (!dateValue) return
    const isoDate = new Date(dateValue + 'T23:59:59').toISOString()
    const existing = expirationMap.get(user.id)
    if (existing) {
      updateExpiration.mutate({ userId: user.id, data: { expires_at: isoDate } }, { onSuccess: handleCancel })
    } else {
      setExpiration.mutate({ user_id: user.id, expires_at: isoDate }, { onSuccess: handleCancel })
    }
  }

  const isSaving = setExpiration.isPending || updateExpiration.isPending

  return (
    <div className="space-y-5">
      <PageHeader
        title="Временный доступ"
        description="Управление сроками доступа пользователей — только суперадмин"
      />

      {/* Stats bar */}
      {!isLoading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Активных', count: stats.active, color: 'bg-emerald-500', filter: 'limited' as const },
            { label: 'Истекает скоро', count: stats.soon, color: 'bg-amber-500', filter: 'limited' as const },
            { label: 'Истёкших', count: stats.expired, color: 'bg-red-500', filter: 'expired' as const },
            { label: 'Без ограничений', count: stats.unlimited, color: 'bg-slate-300', filter: 'unlimited' as const },
          ].map((s) => (
            <button
              key={s.label}
              onClick={() => setFilterStatus(filterStatus === s.filter && s.label !== 'Без ограничений' ? 'all' : s.filter)}
              className={`flex items-center gap-3 p-4 rounded-xl border transition-all text-left ${
                filterStatus === s.filter
                  ? 'border-brand-300 bg-brand-50 shadow-sm'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <span className={`w-3 h-3 rounded-full shrink-0 ${s.color}`} />
              <div>
                <p className="text-xl font-bold text-slate-900">{s.count}</p>
                <p className="text-xs text-slate-500">{s.label}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Expired warning banner */}
      {!isLoading && stats.expired > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <AlertTriangle size={16} className="shrink-0" />
          <span>
            <strong>{stats.expired}</strong> пользователь(ей) с истёкшим сроком. Их аккаунты автоматически заблокированы планировщиком.
          </span>
        </div>
      )}

      <Card>
        {/* Toolbar */}
        <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-3 flex-wrap">
          <Input
            placeholder="Поиск по имени или email..."
            leftIcon={<Search size={15} />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
          {(search || filterStatus !== 'all') && (
            <button
              onClick={() => { setSearch(''); setFilterStatus('all') }}
              className="text-xs text-slate-500 hover:text-slate-700 underline"
            >
              Сбросить фильтр
            </button>
          )}
          <span className="ml-auto text-xs text-slate-400">
            {filteredUsers.length} из {allUsers.length} пользователей
          </span>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : filteredUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-2">
            <Clock size={36} className="opacity-30" />
            <p className="text-sm">Пользователи не найдены</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Пользователь</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Email</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Роли</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Статус</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Срок доступа</th>
                  <th className="px-5 py-3 w-64" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredUsers.map((user) => {
                  const exp = expirationMap.get(user.id)
                  const status = getExpirationStatus(exp)
                  const isEditing = editingUserId === user.id

                  return (
                    <tr key={user.id} className="hover:bg-slate-50/70 transition-colors group">
                      {/* Пользователь */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={user.full_name} size="sm" />
                          <span className="font-medium text-slate-900 whitespace-nowrap">{user.full_name}</span>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="px-5 py-3.5 text-slate-500 whitespace-nowrap">{user.email}</td>

                      {/* Роли */}
                      <td className="px-5 py-3.5">
                        <div className="flex flex-wrap gap-1">
                          {user.roles.length > 0
                            ? user.roles.map((r) => <Badge key={r.id} variant="indigo">{r.name}</Badge>)
                            : <span className="text-slate-300 text-xs">—</span>}
                        </div>
                      </td>

                      {/* Статус */}
                      <td className="px-5 py-3.5">
                        <Badge variant={status.variant} dot>{status.label}</Badge>
                      </td>

                      {/* Срок */}
                      <td className="px-5 py-3.5 text-slate-500 text-xs whitespace-nowrap">
                        {exp
                          ? format(new Date(exp.expires_at), 'dd.MM.yyyy HH:mm')
                          : <span className="text-slate-300">—</span>}
                      </td>

                      {/* Действия */}
                      <td className="px-5 py-3.5">
                        {isEditing ? (
                          <div className="flex items-center gap-2 flex-wrap">
                            <input
                              type="date"
                              value={dateValue}
                              min={todayString()}
                              onChange={(e) => setDateValue(e.target.value)}
                              className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                            />
                            <Button
                              size="sm"
                              loading={isSaving}
                              disabled={!dateValue}
                              onClick={() => handleSave(user)}
                            >
                              Сохранить
                            </Button>
                            <Button size="sm" variant="ghost" disabled={isSaving} onClick={handleCancel}>
                              Отмена
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            {exp ? (
                              <>
                                {/* Edit */}
                                <button
                                  onClick={() => handleEditClick(user)}
                                  title="Изменить срок"
                                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-brand-600 transition-colors"
                                >
                                  <Edit2 size={14} />
                                </button>
                                {/* Remove — prominent labeled button */}
                                <button
                                  onClick={() => setRemoveTarget(user)}
                                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 text-xs font-medium transition-colors"
                                >
                                  <Trash2 size={12} />
                                  Снять ограничение
                                </button>
                              </>
                            ) : (
                              <Button
                                variant="secondary"
                                size="sm"
                                icon={<Plus size={14} />}
                                onClick={() => handleEditClick(user)}
                              >
                                Ограничить доступ
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

      {/* Remove confirm */}
      <ConfirmDialog
        open={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        onConfirm={() => {
          if (!removeTarget) return
          removeExpiration.mutate(removeTarget.id, { onSuccess: () => setRemoveTarget(null) })
        }}
        loading={removeExpiration.isPending}
        title="Снять ограничение доступа?"
        description={
          removeTarget
            ? `Пользователь ${removeTarget.full_name} получит бессрочный доступ. Если аккаунт был заблокирован автоматически — его нужно активировать вручную.`
            : undefined
        }
        confirmLabel="Снять ограничение"
      />
    </div>
  )
}
