import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Mail, Lock } from 'lucide-react'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import { useLogin } from '@/hooks/useAuth'

const schema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password required'),
})
type FormData = z.infer<typeof schema>

export default function LoginPage() {
  const login = useLogin()
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-900">Добро пожаловать</h2>
        <p className="text-slate-500 mt-1.5 text-sm">
          Войдите в свой аккаунт для доступа к CRM
        </p>
      </div>

      <form onSubmit={handleSubmit((d) => login.mutate(d))} className="space-y-4">
        <Input
          label="Email"
          type="email"
          placeholder="you@company.com"
          leftIcon={<Mail size={16} />}
          error={errors.email?.message}
          {...register('email')}
        />
        <Input
          label="Пароль"
          type="password"
          placeholder="••••••••"
          leftIcon={<Lock size={16} />}
          error={errors.password?.message}
          {...register('password')}
        />

        <Button
          type="submit"
          className="w-full mt-2"
          size="lg"
          loading={login.isPending}
        >
          Войти
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        Нет аккаунта?{' '}
        <Link to="/register" className="font-semibold text-brand-600 hover:text-brand-700">
          Зарегистрироваться
        </Link>
      </p>
    </div>
  )
}
