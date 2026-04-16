import { Outlet } from 'react-router-dom'

export default function AuthLayout() {
  return (
    <div className="min-h-screen flex gradient-mesh">
      {/* Left panel — branding */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 p-12 text-white">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <span className="text-xl font-bold tracking-tight">CRM System</span>
        </div>

        <div className="space-y-6">
          <h1 className="text-4xl font-bold leading-tight">
            Управляйте бизнесом<br />
            <span className="text-white/70">умнее и быстрее</span>
          </h1>
          <p className="text-white/60 text-lg leading-relaxed max-w-md">
            Универсальная CRM с конструктором сущностей, управлением ролями и Telegram уведомлениями.
          </p>

          <div className="grid grid-cols-2 gap-4">
            {[
              { icon: '🏢', label: 'Multi-tenant', desc: 'Изолированные данные' },
              { icon: '🔐', label: 'RBAC', desc: 'Гибкие права доступа' },
              { icon: '🔧', label: 'Конструктор', desc: '7 типов полей' },
              { icon: '📱', label: 'Telegram', desc: 'Мгновенные уведомления' },
            ].map((f) => (
              <div key={f.label} className="bg-white/10 backdrop-blur rounded-xl p-4">
                <div className="text-2xl mb-1">{f.icon}</div>
                <div className="font-semibold text-sm">{f.label}</div>
                <div className="text-white/60 text-xs">{f.desc}</div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-white/40 text-sm">© 2026 CRM System. Дипломный проект.</p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-white lg:rounded-l-3xl">
        <div className="w-full max-w-md">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
