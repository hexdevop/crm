import { Outlet, useMatch, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Building2, X } from 'lucide-react'
import Sidebar from '@/components/layout/Sidebar'
import Topbar from '@/components/layout/Topbar'
import { useUIStore } from '@/store/ui.store'
import { useIsSuperAdmin } from '@/store/auth.store'
import { companiesApi } from '@/api/companies'
import { clsx } from 'clsx'

function CompanyContextBanner() {
  const navigate = useNavigate()
  const isSuperAdmin = useIsSuperAdmin()
  const matchDirect = useMatch('/admin/companies/:companyId')
  const matchNested = useMatch('/admin/companies/:companyId/*')
  const companyId = matchDirect?.params?.companyId ?? matchNested?.params?.companyId

  const { data: company } = useQuery({
    queryKey: ['companies', companyId],
    queryFn: () => companiesApi.get(companyId!),
    enabled: isSuperAdmin && !!companyId,
    staleTime: 60_000,
  })

  if (!isSuperAdmin || !companyId || !company) return null

  return (
    <div className="flex items-center gap-3 px-5 py-2 bg-indigo-600 text-white text-sm">
      <Building2 size={15} className="shrink-0 opacity-80" />
      <span className="opacity-80">Вы управляете компанией:</span>
      <span className="font-semibold">{company.name}</span>
      <button
        onClick={() => navigate('/admin/companies')}
        className="ml-auto flex items-center gap-1.5 text-xs opacity-70 hover:opacity-100 transition-opacity"
        title="Выйти из компании"
      >
        <X size={13} />
        Выйти
      </button>
    </div>
  )
}

export default function AppLayout() {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen)

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <Sidebar />

      <div
        className={clsx(
          'flex-1 flex flex-col min-w-0 transition-all duration-200',
          sidebarOpen ? 'lg:ml-64' : 'ml-0'
        )}
      >
        <Topbar />
        <CompanyContextBanner />
        <main className="flex-1 p-6 overflow-auto animate-fade-in">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
