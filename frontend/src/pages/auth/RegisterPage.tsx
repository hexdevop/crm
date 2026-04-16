import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Mail, Lock, User, Building2 } from 'lucide-react'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import { useRegister } from '@/hooks/useAuth'

const schema = z.object({
  company_name: z.string().min(2, 'Название компании обязательно'),
  company_slug: z
    .string()
    .min(2)
    .regex(/^[a-zа-яё0-9-]+$/, 'Только строчные буквы, цифры и дефис'),
  first_name: z.string().min(1, 'Обязательное поле'),
  last_name: z.string().min(1, 'Обязательное поле'),
  email: z.string().email('Неверный email'),
  password: z
    .string()
    .min(8, 'Минимум 8 символов')
    .max(128, 'Максимум 128 символов')
    .regex(/[A-Z]/, 'Нужна заглавная буква')
    .regex(/[a-z]/, 'Нужна строчная буква')
    .regex(/[0-9]/, 'Нужна цифра'),
})
type FormData = z.infer<typeof schema>

export default function RegisterPage() {
  const register_ = useRegister()
  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  // Auto-generate slug from company name
  const handleCompanyNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const slug = e.target.value
      .toLowerCase()
      .replace(/[^a-zа-яё0-9]+/g, '-')
      .replace(/^-|-$/g, '')
    setValue('company_slug', slug)
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-900">Создать компанию</h2>
        <p className="text-slate-500 mt-1.5 text-sm">
          Зарегистрируйте вашу компанию и начните работу
        </p>
      </div>

      <form
        onSubmit={handleSubmit((d) => register_.mutate(d))}
        className="space-y-4"
      >
        <div className="space-y-4 pb-4 border-b border-slate-100">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            О компании
          </p>
          <Input
            label="Название компании"
            placeholder="ООО Ромашка"
            leftIcon={<Building2 size={16} />}
            error={errors.company_name?.message}
            {...register('company_name', { onChange: handleCompanyNameChange })}
          />
          <Input
            label="Slug компании"
            placeholder="ooo-romashka"
            hint="Уникальный идентификатор (будет использован в URL)"
            error={errors.company_slug?.message}
            {...register('company_slug')}
          />
        </div>

        <div className="space-y-4 pb-4 border-b border-slate-100">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Владелец (Owner)
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Имя"
              placeholder="Иван"
              leftIcon={<User size={16} />}
              error={errors.first_name?.message}
              {...register('first_name')}
            />
            <Input
              label="Фамилия"
              placeholder="Иванов"
              error={errors.last_name?.message}
              {...register('last_name')}
            />
          </div>
          <Input
            label="Email"
            type="email"
            placeholder="owner@company.com"
            leftIcon={<Mail size={16} />}
            error={errors.email?.message}
            {...register('email')}
          />
          <Input
            label="Пароль"
            type="password"
            placeholder="Минимум 8 символов"
            leftIcon={<Lock size={16} />}
            hint="Минимум 8 символов, заглавная буква и цифра"
            error={errors.password?.message}
            {...register('password')}
          />
        </div>

        <Button
          type="submit"
          className="w-full"
          size="lg"
          loading={register_.isPending}
        >
          Создать компанию
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        Уже есть аккаунт?{' '}
        <Link to="/login" className="font-semibold text-brand-600 hover:text-brand-700">
          Войти
        </Link>
      </p>
    </div>
  )
}
