import { Menu, Bell } from 'lucide-react'
import { useUIStore } from '@/store/ui.store'
import { useAuthStore } from '@/store/auth.store'
import Avatar from '@/components/ui/Avatar'

export default function Topbar() {
  const toggleSidebar = useUIStore((s) => s.toggleSidebar)
  const sidebarOpen = useUIStore((s) => s.sidebarOpen)
  const user = useAuthStore((s) => s.user)

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center px-6 gap-4 sticky top-0 z-10">
      {!sidebarOpen && (
        <button
          onClick={toggleSidebar}
          className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
        >
          <Menu size={20} />
        </button>
      )}

      <div className="flex-1" />

      {/* Right side */}
      <div className="flex items-center gap-3">
        <button className="relative p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors">
          <Bell size={18} />
        </button>
        <Avatar name={user?.full_name ?? 'User'} size="sm" />
      </div>
    </header>
  )
}
