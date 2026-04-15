import { Link } from 'react-router-dom'
import Button from '@/components/ui/Button'

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <p className="text-8xl font-bold text-brand-600 mb-4">404</p>
        <h1 className="text-2xl font-semibold text-slate-900 mb-2">Страница не найдена</h1>
        <p className="text-slate-500 mb-8">Запрашиваемая страница не существует</p>
        <Link to="/dashboard">
          <Button>На главную</Button>
        </Link>
      </div>
    </div>
  )
}
