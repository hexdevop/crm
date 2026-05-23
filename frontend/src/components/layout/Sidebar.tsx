import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  Shield,
  Database,
  Settings,
  ChevronLeft,
  LogOut,
  Building2,
  ShieldCheck,
  Clock,
  LucideIcon,
} from 'lucide-react'
import { cn } from '@/utils/cn'
import { useUIStore } from '@/store/ui.store'
import { useAuthStore, useHasPermission, useIsSuperAdmin } from '@/store/auth.store'
import { useLogout } from '@/hooks/useAuth'
import Avatar from '@/components/ui/Avatar'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  /** Require this permission code (skipped for superadmin) */
  permission?: string
  /** Only render for superadmins */
  superadminOnly?: boolean
  /** Hide for superadmins (company-scoped pages) */
  hideForSuperadmin?: boolean
}

const navItems: NavItem[] = [
  { to: '/dashboard',       label: 'Дашборд',          icon: LayoutDashboard,  hideForSuperadmin: true },
  { to: '/users',           label: 'Пользователи',      icon: Users,            permission: 'manage_users', hideForSuperadmin: true },
  { to: '/roles',           label: 'Роли',              icon: Shield,           permission: 'manage_roles', hideForSuperadmin: true },
  { to: '/entities',        label: 'Сущности',          icon: Database,         hideForSuperadmin: true },
  { to: '/settings',        label: 'Настройки',         icon: Settings,         hideForSuperadmin: true },
  { to: '/admin/overview',  label: 'Обзор',             icon: ShieldCheck,      superadminOnly: true },
  { to: '/admin/companies', label: 'Компании',          icon: Building2,        superadminOnly: true },
  { to: '/admin/access',    label: 'Временный доступ',  icon: Clock,            superadminOnly: true },
]

function NavItem({ item }: { item: NavItem }) {
  const isSuperAdmin = useIsSuperAdmin()
  const hasPerm = !item.permission || useHasPermission(item.permission)

  if (item.superadminOnly && !isSuperAdmin) return null
  if (item.hideForSuperadmin && isSuperAdmin) return null
  if (!hasPerm) return null

  return (
    <NavLink
      to={item.to}
      end={false}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150',
          isActive
            ? 'bg-brand-600 text-white shadow-sm'
            : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800'
        )
      }
    >
      {({ isActive }) => (
        <>
          <item.icon size={18} className={cn(!isActive && 'opacity-70')} />
          <span>{item.label}</span>
        </>
      )}
    </NavLink>
  )
}

export default function Sidebar() {
  const { sidebarOpen, toggleSidebar } = useUIStore()
  const user = useAuthStore((s) => s.user)
  const logout = useLogout()

  return (
    <>
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 lg:hidden"
          onClick={toggleSidebar}
        />
      )}

      <aside
        className={cn(
          'fixed top-0 left-0 z-30 h-screen w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col transition-transform duration-200',
          !sidebarOpen && '-translate-x-full'
        )}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg gradient-brand flex items-center justify-center shrink-0">
              <Building2 size={16} className="text-white" />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-tight">CRM System</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[130px]">
                {user?.company?.name ?? (user?.is_superadmin ? 'Суперадмин' : '')}
              </div>
            </div>
          </div>
          <button
            onClick={toggleSidebar}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => (
            <NavItem key={item.to} item={item} />
          ))}
        </nav>

        {/* GitHub promo */}
        <div className="px-3 pb-1">
          <a
            href="https://github.com/hexdevop/crm"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 shrink-0 fill-current" aria-hidden="true">
              <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844a9.59 9.59 0 012.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0022 12.017C22 6.484 17.522 2 12 2z" />
            </svg>
            <span>hexdevop/crm</span>
            <span className="ml-auto opacity-60">★</span>
          </a>
        </div>

        {/* User footer */}
        <div className="p-3 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
            <Avatar name={user?.full_name ?? 'User'} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                {user?.full_name}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{user?.email}</p>
            </div>
            <button
              onClick={() => logout.mutate()}
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              title="Выйти"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
