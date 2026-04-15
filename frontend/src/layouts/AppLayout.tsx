import { Outlet } from 'react-router-dom'
import Sidebar from '@/components/layout/Sidebar'
import Topbar from '@/components/layout/Topbar'
import { useUIStore } from '@/store/ui.store'
import { clsx } from 'clsx'

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
        <main className="flex-1 p-6 overflow-auto animate-fade-in">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
