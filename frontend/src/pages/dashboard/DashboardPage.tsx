import { Users, Database, Shield, TrendingUp, ArrowUpRight } from 'lucide-react'
import { useAuthStore } from '@/store/auth.store'
import { useUsers } from '@/hooks/useUsers'
import { useEntities } from '@/hooks/useEntities'
import { useRoles } from '@/hooks/useRoles'
import Card, { CardBody } from '@/components/ui/Card'
import Spinner from '@/components/ui/Spinner'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'

function StatCard({
  title,
  value,
  icon: Icon,
  color,
  trend,
  to,
}: {
  title: string
  value: number | string
  icon: React.ElementType
  color: string
  trend?: string
  to?: string
}) {
  return (
    <Card hover={!!to} onClick={undefined} className="p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-500 font-medium">{title}</p>
          <p className="text-3xl font-bold text-slate-900 mt-2">{value}</p>
          {trend && (
            <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
              <TrendingUp size={12} /> {trend}
            </p>
          )}
        </div>
        <div className={`w-11 h-11 rounded-xl ${color} flex items-center justify-center`}>
          <Icon size={20} className="text-white" />
        </div>
      </div>
      {to && (
        <Link
          to={to}
          className="mt-4 flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700"
        >
          View all <ArrowUpRight size={12} />
        </Link>
      )}
    </Card>
  )
}

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user)
  const { data: usersData } = useUsers({ page: 1, size: 1 })
  const { data: entities, isLoading } = useEntities()
  const { data: roles } = useRoles()

  const now = new Date()
  const greeting =
    now.getHours() < 12 ? 'Доброе утро' : now.getHours() < 18 ? 'Добрый день' : 'Добрый вечер'

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Welcome */}
      <div className="bg-gradient-to-r from-brand-600 to-violet-600 rounded-2xl p-6 text-white">
        <p className="text-white/70 text-sm">{greeting},</p>
        <h2 className="text-2xl font-bold mt-0.5">{user?.full_name} 👋</h2>
        <p className="text-white/60 text-sm mt-2">
          {format(now, "EEEE, d MMMM yyyy", { locale: ru })} · {user?.company?.name}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="Пользователи"
          value={usersData?.total ?? '—'}
          icon={Users}
          color="bg-blue-500"
          to="/users"
        />
        <StatCard
          title="Сущности"
          value={entities?.length ?? '—'}
          icon={Database}
          color="bg-violet-500"
          to="/entities"
        />
        <StatCard
          title="Роли"
          value={roles?.length ?? '—'}
          icon={Shield}
          color="bg-emerald-500"
          to="/roles"
        />
        <StatCard
          title="Записей"
          value={entities?.reduce((acc, e) => acc + e.record_count, 0) ?? '—'}
          icon={TrendingUp}
          color="bg-amber-500"
        />
      </div>

      {/* Entities summary */}
      <div>
        <h3 className="text-sm font-semibold text-slate-900 mb-3">Ваши сущности</h3>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : (entities?.length ?? 0) === 0 ? (
          <Card>
            <CardBody>
              <div className="text-center py-6">
                <p className="text-slate-500 text-sm">Нет созданных сущностей</p>
                <Link
                  to="/entities/new"
                  className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700"
                >
                  Создать первую сущность <ArrowUpRight size={14} />
                </Link>
              </div>
            </CardBody>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {entities?.map((entity) => (
              <Link key={entity.id} to={`/entities/${entity.id}/records`}>
                <Card hover className="p-5">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                      style={{ background: entity.color ? `${entity.color}20` : '#6366f120' }}
                    >
                      {entity.icon ?? '📋'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900 text-sm truncate">
                        {entity.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {entity.record_count} записей · {entity.fields.length} полей
                      </p>
                    </div>
                    <ArrowUpRight size={16} className="text-slate-400 shrink-0" />
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
